/**
 * Fuente propia: un enlace que aporta la persona, no el catálogo ni la lista.
 *
 * Es el tercer origen de la app, y el único con reproductor propio:
 *
 *  - **Canales** (lista M3U) es señal en directo: no se puede pausar ni buscar
 *    en una emisión en vivo, así que no hay barra de progreso que ofrecer.
 *  - **Películas** se reproducen dentro del iframe de un proveedor externo.
 *    Desde aquí no se puede leer ni controlar ese `<video>` —es otro dominio—,
 *    así que tocar su reproducción es imposible, no difícil.
 *  - **Fuente propia** es un `<video>` nuestro, con su tiempo y sus controles
 *    al alcance.
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
  /**
   * @deprecated Lo reemplaza `lib/progreso.ts`, y no es lo mismo escrito dos
   * veces: el progreso vive en su propio almacén, con la misma forma para una
   * fuente propia, una película y un episodio. Guardarlo también aquí serían
   * dos verdades que se desincronizan a la primera.
   *
   * Se conserva el campo para no romper lo que alguien ya tenga guardado en su
   * aparato; nadie lo escribe ni lo lee. Ver `claveDeFuente()`.
   */
  progreso?: number;
}
