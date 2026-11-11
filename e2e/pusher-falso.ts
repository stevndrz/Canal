import { createHmac } from "node:crypto";
import type { BrowserContext, WebSocketRoute } from "@playwright/test";

/**
 * Un Pusher de mentira, en memoria, para las pruebas de Ver juntos.
 *
 * Habla lo justo del protocolo 7 de Pusher para que `pusher-js` no note la
 * diferencia: saludo con `socket_id`, suscripción a un canal de presencia,
 * altas y bajas de miembros, y reenvío de los `client-*` a los demás.
 *
 * Lo que lo hace una prueba y no un decorado: **comprueba la firma**. Calcula
 * por su cuenta el HMAC de `socket_id:canal:channel_data` con el secreto y lo
 * compara con lo que firmó `/api/pusher/auth`. Si la ruta firmara mal —o
 * firmara un canal que no debe—, aquí la suscripción falla igual que fallaría
 * con el Pusher de verdad.
 */

interface Miembro {
  ws: WebSocketRoute;
  canal: string;
  id: string;
  info: unknown;
}

export interface PusherFalso {
  /** Conecta este contexto (este «aparato») al Pusher de mentira. */
  conectar(contexto: BrowserContext): Promise<void>;
  /** Todo lo que los aparatos se mandaron entre sí, en orden. */
  mensajes: { canal: string; de: string; dato: unknown }[];
  /** Suscripciones rechazadas por firma mala. */
  rechazadas: string[];
  /** Corta la conexión de todos los aparatos de un contexto (como un túnel). */
  cortar(contexto: BrowserContext): Promise<void>;
  /**
   * Vuelve a entregar a los demás el último mensaje que cumpla `cual`, como si
   * llegara ahora: un mensaje que se cruzó por el camino. `false` si no hay.
   */
  entregarTarde(cual: (dato: Record<string, unknown>) => boolean): boolean;
}

export function crearPusherFalso(clave: string, secreto: string): PusherFalso {
  const miembros = new Set<Miembro>();
  const porContexto = new Map<BrowserContext, Set<WebSocketRoute>>();
  const mensajes: PusherFalso["mensajes"] = [];
  const rechazadas: string[] = [];
  /** Lo mismo que `mensajes`, con lo que hace falta para volver a entregarlos. */
  const enviados: { canal: string; de: string; evento: string; dato: unknown; ws: WebSocketRoute }[] = [];
  let siguiente = 1;

  const mandar = (ws: WebSocketRoute, evento: string, dato: unknown, extra: Record<string, unknown> = {}) => {
    try {
      ws.send(JSON.stringify({ event: evento, data: typeof dato === "string" ? dato : JSON.stringify(dato), ...extra }));
    } catch {
      // El aparato ya cerró: no hay a quién contarle nada.
    }
  };

  const baja = (ws: WebSocketRoute) => {
    for (const m of [...miembros]) {
      if (m.ws !== ws) continue;
      miembros.delete(m);
      for (const otro of miembros) {
        if (otro.canal === m.canal) mandar(otro.ws, "pusher_internal:member_removed", { user_id: m.id }, { channel: m.canal });
      }
    }
  };

  const atender = (contexto: BrowserContext) => (ws: WebSocketRoute) => {
    const socketId = `${siguiente++}.${Date.now() % 1_000_000}`;
    let vistos = porContexto.get(contexto);
    if (!vistos) porContexto.set(contexto, (vistos = new Set()));
    vistos.add(ws);
    mandar(ws, "pusher:connection_established", { socket_id: socketId, activity_timeout: 120 });

    ws.onMessage((crudo) => {
      let mensaje: { event?: string; data?: unknown; channel?: string };
      try {
        mensaje = JSON.parse(String(crudo));
      } catch {
        return;
      }
      if (mensaje.event === "pusher:ping") {
        mandar(ws, "pusher:pong", {});
        return;
      }
      if (mensaje.event === "pusher:subscribe") {
        const d = mensaje.data as { channel: string; auth?: string; channel_data?: string };
        const esperada = `${clave}:${createHmac("sha256", secreto)
          .update(`${socketId}:${d.channel}:${d.channel_data ?? ""}`)
          .digest("hex")}`;
        if (d.auth !== esperada || !d.channel_data) {
          rechazadas.push(d.channel);
          mandar(ws, "pusher:subscription_error", { type: "AuthError", error: "Firma inválida", status: 401 }, { channel: d.channel });
          return;
        }
        const quien = JSON.parse(d.channel_data) as { user_id: string; user_info: unknown };
        const nuevo: Miembro = { ws, canal: d.channel, id: quien.user_id, info: quien.user_info };
        const yaEstaban = [...miembros].filter((m) => m.canal === d.channel);
        miembros.add(nuevo);
        const todos = [...yaEstaban, nuevo];
        mandar(
          ws,
          "pusher_internal:subscription_succeeded",
          {
            presence: {
              count: todos.length,
              ids: todos.map((m) => m.id),
              hash: Object.fromEntries(todos.map((m) => [m.id, m.info])),
            },
          },
          { channel: d.channel },
        );
        for (const otro of yaEstaban) {
          mandar(otro.ws, "pusher_internal:member_added", { user_id: nuevo.id, user_info: nuevo.info }, { channel: d.channel });
        }
        return;
      }
      if (mensaje.event?.startsWith("client-") && mensaje.channel) {
        const de = [...miembros].find((m) => m.ws === ws && m.canal === mensaje.channel);
        // Como Pusher: sin estar suscrito al canal, no se puede hablar en él.
        if (!de) return;
        mensajes.push({ canal: de.canal, de: de.id, dato: mensaje.data });
        enviados.push({ canal: de.canal, de: de.id, evento: mensaje.event, dato: mensaje.data, ws });
        for (const otro of miembros) {
          if (otro.canal !== de.canal || otro.ws === ws) continue;
          mandar(otro.ws, mensaje.event, mensaje.data, { channel: de.canal, user_id: de.id });
        }
      }
    });
    ws.onClose(() => {
      vistos.delete(ws);
      baja(ws);
    });
  };

  return {
    mensajes,
    rechazadas,
    async conectar(contexto) {
      await contexto.routeWebSocket(/pusher(app)?\.com/, atender(contexto));
    },
    entregarTarde(cual) {
      const viejo = enviados.findLast((m) => Boolean(m.dato) && typeof m.dato === "object" && cual(m.dato as Record<string, unknown>));
      if (!viejo) return false;
      for (const otro of miembros) {
        if (otro.canal !== viejo.canal || otro.ws === viejo.ws) continue;
        mandar(otro.ws, viejo.evento, viejo.dato, { channel: viejo.canal, user_id: viejo.de });
      }
      return true;
    },
    async cortar(contexto) {
      for (const ws of [...(porContexto.get(contexto) ?? [])]) {
        baja(ws);
        await ws.close();
      }
    },
  };
}
