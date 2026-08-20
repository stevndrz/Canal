/**
 * Catálogo híbrido de Películas y Series.
 *
 * Cada ficha se reproduce de una de dos formas:
 *  - `embed`  -> se incrusta el reproductor de un proveedor externo por iframe.
 *               Ese reproductor trae sus propios controles y su propio watch
 *               party, así que aquí no añadimos nada encima.
 *  - `manual` -> enlace propio (.mp4 / .m3u8). Solo en este caso usamos el
 *               reproductor nativo con pistas de audio, subtítulos y el
 *               Watch Party sincronizado por Pusher.
 */

export type MediaType = "movie" | "tv";

/** Reproducción delegada a un proveedor externo por iframe. */
export interface EmbedSource {
  kind: "embed";
  /** Clave del proveedor; si se omite se usa el configurado por defecto. */
  provider?: string;
}

export interface SubtitleTrack {
  label: string;
  /** Código de idioma BCP 47, ej. "es", "es-419", "en". */
  srclang: string;
  /** URL de un archivo .vtt (el formato que entiende <track> de forma nativa). */
  url: string;
  default?: boolean;
}

/** Una versión concreta reproducible: un idioma, una calidad, una URL. */
export interface ManualStream {
  /** Lo que ve el usuario en el selector, ej. "Latino 1080p". */
  label: string;
  url: string;
  /** `auto` deduce el motor por la extensión de la URL. */
  type?: "hls" | "mp4" | "auto";
  subtitles?: SubtitleTrack[];
}

export interface ManualSource {
  kind: "manual";
  streams: ManualStream[];
}

export type PlaybackSource = EmbedSource | ManualSource;

/** Excepción para un episodio suelto (otro doblaje, otro enlace). */
export interface CatalogEpisode {
  season: number;
  episode: number;
  /** Sobrescribe el título que devuelve TMDB. */
  title?: string;
  overview?: string;
  /** Si se omite, el episodio hereda la fuente de la serie. */
  source?: PlaybackSource;
}

export interface CatalogItem {
  /** Identificador interno estable; es lo que va en la URL. */
  id: string;
  mediaType: MediaType;
  /** Sin `tmdbId` hay que rellenar título y póster a mano. */
  tmdbId?: number;
  /** Estos tres sobrescriben lo que devuelva TMDB. */
  title?: string;
  poster?: string;
  overview?: string;
  /** Agrupación libre para las filas del catálogo, ej. "Para la familia". */
  collection?: string;
  source: PlaybackSource;
  episodes?: CatalogEpisode[];
}

/**
 * Ficha ya combinada con los datos de TMDB, lista para pintar.
 *
 * Se omiten los campos opcionales del original porque aquí ya están resueltos:
 * `poster` pasa de "puede no venir" (`undefined`) a "se buscó y puede no haber"
 * (`null`), que son cosas distintas para la UI.
 */
export interface ResolvedCatalogItem extends Omit<CatalogItem, "title" | "poster" | "overview"> {
  title: string;
  poster: string | null;
  overview: string;
  backdrop: string | null;
  year: string | null;
  rating: number | null;
  /** Números de temporada disponibles (vacío en películas). */
  seasons: number[];
  /**
   * Idioma en que se rodó, según TMDB (`es`, `en`…).
   *
   * Es la ÚNICA señal fiable sobre el audio: si es `es`, se oye en español sin
   * depender de doblajes. Ningún proveedor de iframe publica qué pistas de
   * audio tiene, así que cualquier otra promesa de "audio en español" sería
   * inventada.
   */
  originalLanguage: string | null;
}

export interface ResolvedEpisode {
  season: number;
  episode: number;
  title: string;
  overview: string;
  still: string | null;
  source: PlaybackSource;
}

/**
 * Una fila del catálogo: un título y las fichas que van debajo.
 *
 * Existía ya como forma anónima devuelta por `getCatalogSections()`; tiene
 * nombre desde que Inicio también pinta estas filas y las dos pantallas
 * necesitan referirse al mismo tipo.
 */
export interface CatalogSection {
  title: string;
  items: ResolvedCatalogItem[];
}
