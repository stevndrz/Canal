import type { MediaType } from "./types";

/**
 * Los nombres de género que TMDB deja en inglés aunque se le pida `es-MX`.
 *
 * Con las películas traduce bien («Acción», «Terror»), pero la lista de
 * SERIES llega a medias: «Action & Adventure», «Kids», «News», «Reality»,
 * «Sci-Fi & Fantasy», «Soap», «Talk» y «War & Politics» salían tal cual en el
 * panel de géneros y en la ficha. Una abuela que busca telenovelas no va a
 * pulsar «Soap».
 *
 * Va por id y no por nombre: el id es estable y el nombre que manda TMDB
 * puede cambiar el día que decidan traducirlo ellos (o traducirlo mal). Solo
 * se listan los ids que son exclusivos de series; los comunes (Animación,
 * Comedia, Drama…) ya llegan bien en español.
 */
const GENEROS_SERIE: Record<number, string> = {
  10759: "Acción y aventura",
  10762: "Infantil",
  10763: "Noticias",
  10764: "Telerrealidad",
  10765: "Ciencia ficción y fantasía",
  10766: "Telenovela",
  10767: "Programas de entrevistas",
  10768: "Bélica y política",
};

/**
 * Géneros que no deben abrir una fila «por defecto» de series.
 *
 * Noticias y programas de entrevistas son lo más «popular» de TMDB cada noche
 * —se emiten a diario y acumulan votos—, así que «Series populares» empezaba
 * con «The Tonight Show» y «The Late Show»: programas en inglés sin doblar que
 * nadie en casa viene a buscar a Cine y series. Se quitan de las filas que
 * nadie pidió; si alguien elige el género a propósito, lo tiene.
 */
export const GENEROS_FUERA_DE_FILAS_DE_SERIES = [10763, 10767] as const;

/** Terror: no se ofrece de entrada en la portada, donde puede haber niños. */
export const GENERO_TERROR = 27;

/**
 * El nombre de un género en español.
 *
 * Si el id es uno de los que TMDB deja en inglés, se usa la tabla; si no, el
 * nombre que mandó TMDB. Así un género nuevo que aparezca mañana se ve con su
 * nombre original en vez de desaparecer o salir vacío.
 */
export function nombreDeGenero(mediaType: MediaType, id: number, nombreTmdb: string): string {
  if (mediaType === "tv") return GENEROS_SERIE[id] ?? nombreTmdb;
  return nombreTmdb;
}

/** Ver `nombreDeGenero`, aplicado a una lista entera. */
export function traducirGeneros<T extends { id: number; name: string }>(
  mediaType: MediaType,
  generos: readonly T[],
): T[] {
  return generos.map((genero) => ({ ...genero, name: nombreDeGenero(mediaType, genero.id, genero.name) }));
}
