import { publicConfig } from "@/lib/config";
import type { Perfil } from "./recordar";
import { canalDeSala } from "./sala";

/**
 * Entrar en el canal de presencia de una sala: la conexión a Pusher, sin
 * nada de vídeo.
 *
 * Nació para la sincronía suave (`use-reloj-sala.ts`), que necesita la sala
 * —quién está, mandar y recibir— pero no tiene `<video>` que mover.
 * `use-ver-juntos.ts` lleva su propia copia de esto mezclada con el vídeo;
 * moverlo aquí es un refactor pendiente, aparte, para no tocar lo que ya
 * funciona en el mismo cambio.
 */

export interface MiembroDeSala {
  id: string;
  nombre: string;
}

interface MiembroPusher {
  id: string;
  info?: { nombre?: unknown };
}

interface CanalPusher {
  bind(evento: string, fn: (dato: unknown, metadatos?: { user_id?: string }) => void): void;
  trigger(evento: string, dato: unknown): boolean;
}

interface ClientePusher {
  subscribe(canal: string): CanalPusher;
  disconnect(): void;
  connection: { bind(evento: string, fn: (cambio?: { current?: string }) => void): void };
}

export interface CanalDeSala {
  /** Manda a los demás. Sin suscripción (aún, o ya) no hace nada. */
  enviar(dato: unknown): void;
  cerrar(): void;
}

const nombreDe = (m: MiembroPusher) => (typeof m.info?.nombre === "string" && m.info.nombre ? m.info.nombre : "Alguien");

export function abrirCanalDeSala(
  perfil: Perfil,
  codigo: string,
  evento: string,
  al: {
    /** Quién está, por orden de llegada, este aparato incluido. Vacío = sin conexión. */
    miembros(lista: MiembroDeSala[]): void;
    mensaje(dato: unknown, de: string | undefined): void;
    /** Suscrito (también tras reconectar): buen momento para saludar. */
    dentro(): void;
    error(): void;
  },
): CanalDeSala {
  let cerrado = false;
  let suscrito = false;
  let cliente: ClientePusher | null = null;
  let canal: CanalPusher | null = null;
  let orden: string[] = [];
  const nombres = new Map<string, string>();
  const publicar = () => al.miembros(orden.map((id) => ({ id, nombre: nombres.get(id) ?? "Alguien" })));

  (async () => {
    try {
      const { default: Pusher } = await import("pusher-js");
      if (cerrado) return;
      cliente = new Pusher(publicConfig.pusherKey, {
        cluster: publicConfig.pusherCluster,
        channelAuthorization: {
          endpoint: "/api/pusher/auth",
          transport: "ajax",
          params: { id: perfil.id, nombre: perfil.nombre },
        },
      }) as unknown as ClientePusher;
      canal = cliente.subscribe(canalDeSala(codigo));
      canal.bind("pusher:subscription_succeeded", (dato) => {
        if (cerrado) return;
        suscrito = true;
        const otros: string[] = [];
        nombres.clear();
        (dato as { each(fn: (m: MiembroPusher) => void): void } | undefined)?.each((m) => {
          nombres.set(m.id, nombreDe(m));
          if (m.id !== perfil.id) otros.push(m.id);
        });
        nombres.set(perfil.id, perfil.nombre);
        orden = [...otros.sort(), perfil.id];
        publicar();
        al.dentro();
      });
      canal.bind("pusher:member_added", (dato) => {
        const m = dato as MiembroPusher;
        if (cerrado || !m?.id) return;
        nombres.set(m.id, nombreDe(m));
        if (!orden.includes(m.id)) orden = [...orden, m.id];
        publicar();
      });
      canal.bind("pusher:member_removed", (dato) => {
        const m = dato as MiembroPusher;
        if (cerrado || !m?.id) return;
        orden = orden.filter((id) => id !== m.id);
        publicar();
      });
      canal.bind("pusher:subscription_error", () => {
        if (!cerrado) al.error();
      });
      canal.bind(evento, (dato, metadatos) => {
        if (!cerrado) al.mensaje(dato, metadatos?.user_id);
      });
      cliente.connection.bind("error", () => {
        if (!cerrado) al.error();
      });
      cliente.connection.bind("state_change", (cambio) => {
        if (cambio?.current !== "connected") suscrito = false;
      });
    } catch (error) {
      console.error("❌ Sala: no se pudo conectar", error);
      if (!cerrado) al.error();
    }
  })();

  return {
    enviar(dato) {
      if (!canal || !suscrito) return;
      try {
        canal.trigger(evento, dato);
      } catch (error) {
        // Falla si «Enable client events» está apagado en el panel de Pusher.
        console.warn("Sala: no se pudo enviar", error);
      }
    },
    cerrar() {
      cerrado = true;
      suscrito = false;
      try {
        cliente?.disconnect();
      } catch {
        // Cerrar una conexión ya cerrada no es un problema.
      }
    },
  };
}
