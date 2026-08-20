/**
 * Fuente propia: un enlace que aporta la persona, no el catálogo ni la lista.
 *
 * Es el tercer origen de la app, y el único donde el Watch Party tiene sentido:
 *
 *  - **Canales** (lista M3U) es señal en directo. Dos personas viendo el mismo
 *    canal ya están sincronizadas por definición: no hay nada que igualar,
 *    porque no se puede pausar ni buscar en una emisión en vivo.
 *  - **Películas** se reproducen dentro del iframe de un proveedor externo.
 *    Desde aquí no se puede leer ni controlar ese `<video>` —es otro dominio—,
 *    así que sincronizarlo es imposible, no difícil.
 *  - **Fuente propia** es un `<video>` nuestro, con su tiempo y sus controles
 *    al alcance. Ahí sí se puede igualar el segundo exacto entre dos casas.
 *
 * Este módulo define el contrato y no implementa la pantalla: es la base sobre
 * la que construir la funcionalidad, para que quien la escriba no tenga que
 * decidir otra vez estas cosas.
 */

/** Cómo se va a reproducir el enlace. */
export type ClaseFuente =
  /** Archivo progresivo que el `<video>` entiende sin ayuda: .mp4, .webm, .mov. */
  | "nativo"
  /** Contenedor que casi ningún navegador reproduce; ver la nota de `.mkv`. */
  | "matroska"
  /** Lista HLS: .m3u8. Se reproduce con hls.js, igual que los canales. */
  | "hls"
  /** Transporte MPEG-TS o FLV. Se reproduce con mpegts.js. */
  | "mpegts"
  /**
   * Enlace magnet. Solo llega a guardarse si traía una réplica HTTP dentro;
   * ver `magnet.ts`, que explica por qué los demás no pueden reproducirse.
   */
  | "magnet"
  /** No se reconoce por la extensión; se intentará como HLS, que es lo común. */
  | "desconocida";

export interface FuentePropia {
  /** Identificador estable dentro de la lista guardada. */
  id: string;
  /** Lo que se lee en la interfaz. Si no se escribe, se deriva del enlace. */
  titulo: string;
  /** El enlace que se reproduce. Con un magnet, su réplica HTTP ya resuelta. */
  url: string;
  clase: ClaseFuente;
  /** El magnet original, cuando la fuente vino de uno. Solo para mostrarlo. */
  magnet?: string;
  /** Marca de tiempo de alta, para ordenar «lo último que añadí». */
  creadaEn: number;
  /** Segundo por el que iba, para poder continuar. */
  progreso?: number;
}

/**
 * Una sala de Watch Party sobre una fuente propia.
 *
 * El identificador de sala ya existe en `src/lib/watch-party/sign.ts`
 * (`normalizeRoomId`, `WATCH_PARTY_CHANNEL`) y la sincronización en
 * `src/hooks/use-watch-party.ts`. Esta forma solo une las dos mitades: qué se
 * ve y con quién.
 */
export interface SalaFuentePropia {
  /** Id normalizado con `normalizeRoomId`. */
  sala: string;
  /** La fuente que están viendo todos los de la sala. */
  fuenteId: string;
}
