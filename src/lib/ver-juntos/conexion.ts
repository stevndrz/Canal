import { publicConfig } from "@/lib/config";
import type { Perfil } from "./recordar";
import { canalDeSala } from "./sala";

/**
 * Entrar en el canal de presencia de una sala: la conexión a Pusher, sin
 * nada de vídeo.
 *
 * La única conexión de sala que hay. La usan las dos formas de ver juntos:
 * `use-ver-juntos.ts` (Nuestras películas, que además mueve un `<video>`) y
 * `use-reloj-sala.ts` (la sincronía suave, que solo lleva un reloj). Cada una
 * con su evento, para no pisarse dentro de la misma sala.
 */

/** Por qué cambió la lista: se entró (o se volvió a entrar), llegó alguien o se fue alguien. */
export type CambioDeMiembros = "entrada" | "alta" | "baja";
/** Qué falló: la firma de la sala, la conexión ya abierta, o cargar el cliente. */
export type FalloDeConexion = "firma" | "conexion" | "carga";

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
  connect(): void;
  disconnect(): void;
  connection: { bind(evento: string, fn: (cambio?: { current?: string }) => void): void };
}

export interface CanalDeSala {
  /** Manda a los demás. Sin suscripción (aún, o ya) no hace nada. */
  enviar(dato: unknown): void;
  /** ¿Se puede mandar ahora mismo? */
  suscrito(): boolean;
  /**
   * Rehace la conexión a la fuerza. Safari en iPhone congela la página al
   * cambiar de app y el socket muere sin avisar: `pusher-js` no lo nota hasta
   * su propio ping, minutos después. `pusher-js` vuelve a suscribir solo.
   */
  rehacer(): void;
  /**
   * Cuelga. `trasMs` deja salir un último mensaje antes: colgar en el mismo
   * instante lo perdía (medido).
   */
  cerrar(trasMs?: number): void;
}

const nombreDe = (m: MiembroPusher) => (typeof m.info?.nombre === "string" && m.info.nombre ? m.info.nombre : "Alguien");

export function abrirCanalDeSala(
  perfil: Perfil,
  codigo: string,
  evento: string,
  al: {
    /** Quién está, por orden de llegada, este aparato incluido. Vacío = sin conexión. */
    miembros(lista: MiembroDeSala[], por: CambioDeMiembros): void;
    mensaje(dato: unknown, de: string | undefined): void;
    /** Suscrito (también tras reconectar): buen momento para saludar. */
    dentro(): void;
    error(motivo: FalloDeConexion): void;
  },
): CanalDeSala {
  let cerrado = false;
  let suscrito = false;
  let cliente: ClientePusher | null = null;
  let canal: CanalPusher | null = null;
  let orden: string[] = [];
  const nombres = new Map<string, string>();
  const publicar = (por: CambioDeMiembros) => al.miembros(orden.map((id) => ({ id, nombre: nombres.get(id) ?? "Alguien" })), por);

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
        // Los que ya estaban, antes; este aparato, al final. Entre ellos, por
        // id, para que todos vean el mismo orden.
        orden = [...otros.sort(), perfil.id];
        publicar("entrada");
        al.dentro();
      });
      canal.bind("pusher:member_added", (dato) => {
        const m = dato as MiembroPusher;
        if (cerrado || !m?.id) return;
        nombres.set(m.id, nombreDe(m));
        if (!orden.includes(m.id)) orden = [...orden, m.id];
        publicar("alta");
      });
      canal.bind("pusher:member_removed", (dato) => {
        const m = dato as MiembroPusher;
        if (cerrado || !m?.id) return;
        orden = orden.filter((id) => id !== m.id);
        publicar("baja");
      });
      canal.bind("pusher:subscription_error", () => {
        if (!cerrado) al.error("firma");
      });
      canal.bind(evento, (dato, metadatos) => {
        if (!cerrado) al.mensaje(dato, metadatos?.user_id);
      });
      cliente.connection.bind("error", () => {
        if (!cerrado) al.error("conexion");
      });
      cliente.connection.bind("state_change", (cambio) => {
        if (cambio?.current !== "connected") suscrito = false;
      });
    } catch (error) {
      console.error("❌ Sala: no se pudo conectar", error);
      if (!cerrado) al.error("carga");
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
    suscrito: () => suscrito,
    rehacer() {
      if (cerrado || !cliente) return;
      suscrito = false;
      cliente.disconnect();
      cliente.connect();
    },
    cerrar(trasMs = 0) {
      cerrado = true;
      suscrito = false;
      const colgar = () => {
        try {
          // Desconectar ya da de baja el canal; darlo de baja antes mandaba
          // un mensaje más por un socket que se estaba cerrando.
          cliente?.disconnect();
        } catch {
          // Cerrar una conexión ya cerrada no es un problema.
        }
      };
      if (trasMs > 0) setTimeout(colgar, trasMs);
      else colgar();
    },
  };
}
