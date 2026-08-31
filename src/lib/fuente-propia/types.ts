/**
 * Fuente propia: un enlace que aporta la persona, y el único de los tres
 * orígenes con reproductor propio. Canales es señal en directo —no hay
 * progreso que ofrecer— y las películas viven en un iframe de otro dominio,
 * donde leer o controlar el `<video>` es imposible, no difícil.
 *
 * Aquí solo el contrato; la pantalla es `views/fuente-view.tsx`.
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
  /** Magnet. Solo se guarda si traía réplica HTTP dentro; ver `magnet.ts`. */
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
  /**
   * @deprecated Lo reemplaza `lib/progreso.ts`, que guarda el progreso de todo
   * con la misma forma. Guardarlo también aquí serían dos verdades que se
   * desincronizan. Se conserva para no romper lo ya guardado en algún aparato.
   */
  progreso?: number;
}
