/**
 * Lo que la portada de la sala enseña de una película: sus audios, su
 * duración y su arte de TMDB. Funciones puras; la red va en los hooks.
 */

/**
 * Los audios de un HLS, leídos de su `master.m3u8`.
 *
 * El catálogo de R2 no los apunta, y el script de subida los mete en el HLS
 * como `#EXT-X-MEDIA:TYPE=AUDIO,…,NAME="Inglés"`. Leer ese texto (unos pocos
 * cientos de bytes) da los nombres sin cargar la película.
 */
export function audiosDelMaster(texto: string): string[] {
  const nombres: string[] = [];
  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.startsWith("#EXT-X-MEDIA:") || !/TYPE=AUDIO(,|$)/.test(linea)) continue;
    const nombre = /NAME="([^"]*)"/.exec(linea)?.[1]?.trim();
    if (nombre && !nombres.includes(nombre)) nombres.push(nombre);
  }
  return nombres;
}

export function duracionCorta(segundos?: number): string {
  if (!segundos) return "";
  const minutos = Math.round(segundos / 60);
  return minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos} min`;
}

export interface Arte {
  fondo: string | null;
  poster: string | null;
}

interface Resultado {
  title?: unknown;
  mediaType?: unknown;
  backdrop?: unknown;
  poster?: unknown;
}

const texto = (v: unknown) => (typeof v === "string" && /^https:\/\//.test(v) ? v : null);
const comparable = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * De lo que devuelve `/api/buscar`, el arte de la película que se llama así.
 *
 * Solo películas, y primero la que coincide en título exacto: buscar
 * «Coco» trae también series y documentales con «Coco» en el nombre.
 */
export function arteDe(resultados: unknown, titulo: string): Arte | null {
  if (!Array.isArray(resultados)) return null;
  const peliculas = (resultados as Resultado[]).filter((r) => r && r.mediaType === "movie");
  const buscado = comparable(titulo);
  const elegido =
    peliculas.find((r) => typeof r.title === "string" && comparable(r.title) === buscado) ?? peliculas[0];
  if (!elegido) return null;
  const arte = { fondo: texto(elegido.backdrop), poster: texto(elegido.poster) };
  return arte.fondo || arte.poster ? arte : null;
}
