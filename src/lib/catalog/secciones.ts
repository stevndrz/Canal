import type { MediaType } from "./types";

/**
 * Las tres secciones del catálogo: Películas, Series y Anime.
 *
 * Antes era una sola, «Cine y series», con píldoras Todo/Películas/Series. Se
 * separan porque se busca distinto: quien entra a ver una serie no quiere
 * pasar por cinco filas de películas, y el anime es un mundo aparte —sobre
 * todo series, con su propio público en casa—.
 *
 * Las fichas siguen en `/peliculas/[mediaType]/[id]` para no romper enlaces,
 * «Seguir viendo» ni «Mi lista», que guardan esa ruta.
 */
export type SeccionCatalogo = "peliculas" | "series" | "anime";

export interface DefinicionSeccion {
  id: SeccionCatalogo;
  ruta: string;
  titulo: string;
  /**
   * El tipo fijo de la sección, o `null` si deja elegir (anime: hay series y
   * películas, y las dos son anime).
   */
  tipoFijo: MediaType | null;
}

export const SECCIONES: Record<SeccionCatalogo, DefinicionSeccion> = {
  peliculas: { id: "peliculas", ruta: "/peliculas", titulo: "Películas", tipoFijo: "movie" },
  series: { id: "series", ruta: "/series", titulo: "Series", tipoFijo: "tv" },
  anime: { id: "anime", ruta: "/anime", titulo: "Anime", tipoFijo: null },
};

/**
 * Qué cuenta como anime en TMDB: animación japonesa.
 *
 * TMDB no tiene un género «Anime»; lo que la gente llama así es la
 * intersección de Animación (16) con idioma original japonés. Deja fuera
 * algo de animación coreana o china, y a cambio no mete Pixar ni Disney.
 */
export const ANIMACION = 16;
export const IDIOMA_ANIME = "ja";

/** Dónde vive el catálogo de un tipo cuando no se está en Anime. */
export function rutaDeTipo(mediaType: MediaType): string {
  return mediaType === "tv" ? SECCIONES.series.ruta : SECCIONES.peliculas.ruta;
}

/**
 * La sección que se marca en la barra para una ruta.
 *
 * Las fichas cuelgan todas de `/peliculas/…`, así que sin esto abrir una serie
 * encendía «Películas». Una serie de anime se marca como Series: la ficha no
 * sabe de qué sección vino, y Series es lo que es.
 */
export function seccionDeRuta(pathname: string): SeccionCatalogo | null {
  if (pathname.startsWith("/peliculas/tv/")) return "series";
  if (pathname.startsWith("/peliculas")) return "peliculas";
  if (pathname.startsWith("/series")) return "series";
  if (pathname.startsWith("/anime")) return "anime";
  return null;
}
