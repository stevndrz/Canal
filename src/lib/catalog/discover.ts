import { fetchList, searchTitles, type TmdbListEntry } from "./tmdb";
import type { MediaType, ResolvedCatalogItem } from "./types";

/**
 * Filas del catálogo servidas por TMDB.
 *
 * El orden de `CATALOG_ROWS` es la prioridad que se ve en pantalla: primero lo
 * hablado en español, que es lo único donde el audio en español está
 * garantizado, y debajo el resto del catálogo internacional. Nada queda fuera:
 * una película en inglés aparece igual, con su título y su sinopsis en español.
 */

/** Géneros de TMDB usados abajo (los nombres los devuelve la API en español). */
const GENRE = {
  familia: 10751,
  accion: 28,
  comedia: 35,
  terror: 27,
  animacion: 16,
} as const;

interface RowSpec {
  title: string;
  path: string;
  /** Tipo que se asume cuando la respuesta no trae `media_type` (discover). */
  mediaType: MediaType;
}

/** Solo títulos con cierto respaldo de votos: evita rellenar con lo irrelevante. */
const MOVIE_BASE = "sort_by=popularity.desc&vote_count.gte=200&include_adult=false";
const TV_BASE = "sort_by=popularity.desc&vote_count.gte=100&include_adult=false";
/** El cine hispano tiene menos votos que el de Hollywood; si no, sale casi vacío. */
const ES_MOVIE_BASE = "sort_by=popularity.desc&vote_count.gte=50&include_adult=false";
const ES_TV_BASE = "sort_by=popularity.desc&vote_count.gte=20&include_adult=false";

const CATALOG_ROWS: RowSpec[] = [
  {
    title: "Películas en español",
    path: `/discover/movie?with_original_language=es&${ES_MOVIE_BASE}`,
    mediaType: "movie",
  },
  {
    title: "Series en español",
    path: `/discover/tv?with_original_language=es&${ES_TV_BASE}`,
    mediaType: "tv",
  },
  { title: "Tendencias de la semana", path: "/trending/all/week", mediaType: "movie" },
  { title: "Películas populares", path: `/discover/movie?${MOVIE_BASE}`, mediaType: "movie" },
  { title: "Series populares", path: `/discover/tv?${TV_BASE}`, mediaType: "tv" },
  {
    title: "Para toda la familia",
    path: `/discover/movie?with_genres=${GENRE.familia}&${MOVIE_BASE}`,
    mediaType: "movie",
  },
  {
    title: "Acción",
    path: `/discover/movie?with_genres=${GENRE.accion}&${MOVIE_BASE}`,
    mediaType: "movie",
  },
  {
    title: "Comedia",
    path: `/discover/movie?with_genres=${GENRE.comedia}&${MOVIE_BASE}`,
    mediaType: "movie",
  },
  {
    title: "Animación",
    path: `/discover/movie?with_genres=${GENRE.animacion}&${MOVIE_BASE}`,
    mediaType: "movie",
  },
  {
    title: "Terror",
    path: `/discover/movie?with_genres=${GENRE.terror}&${MOVIE_BASE}`,
    mediaType: "movie",
  },
];

/**
 * Prefijo de los ids que salen de TMDB, para que no puedan chocar con los
 * escritos a mano en catalog.json. La ficha reconstruye el tmdbId a partir de
 * aquí, así que ninguna tarjeta necesita estar dada de alta en el JSON.
 */
const TMDB_ID_PREFIX = "tmdb-";

export function toCatalogId(tmdbId: number): string {
  return `${TMDB_ID_PREFIX}${tmdbId}`;
}

/** El tmdbId escondido en un id de catálogo, o null si no es uno de TMDB. */
export function tmdbIdFromCatalogId(id: string): number | null {
  if (!id.startsWith(TMDB_ID_PREFIX)) return null;
  const value = Number(id.slice(TMDB_ID_PREFIX.length));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function toCatalogItem(entry: TmdbListEntry): ResolvedCatalogItem {
  return {
    id: toCatalogId(entry.tmdbId),
    mediaType: entry.mediaType,
    tmdbId: entry.tmdbId,
    title: entry.title,
    poster: entry.poster,
    overview: entry.overview,
    backdrop: entry.backdrop,
    year: entry.year,
    rating: entry.rating,
    originalLanguage: entry.originalLanguage,
    source: { kind: "embed" },
    // Las temporadas solo hacen falta en la ficha, y allí se piden aparte con
    // fetchTitle(). Pedirlas aquí costaría una petición por serie.
    seasons: [],
  };
}

export interface DiscoverSection {
  title: string;
  items: ResolvedCatalogItem[];
}

/**
 * Todas las filas, en paralelo: una petición por fila y cada una cacheada un
 * día. Las que vengan vacías (sin clave, o TMDB caído) se descartan en vez de
 * dejar un hueco con título y nada debajo.
 */
export async function fetchCatalogRows(): Promise<DiscoverSection[]> {
  const rows = await Promise.all(
    CATALOG_ROWS.map(async (row) => ({
      title: row.title,
      items: (await fetchList(row.path, row.mediaType)).map(toCatalogItem),
    }))
  );
  return rows.filter((row) => row.items.length > 0);
}

/** Resultados de búsqueda, ya listos para pintar como cualquier otra ficha. */
export async function searchCatalog(query: string): Promise<ResolvedCatalogItem[]> {
  return (await searchTitles(query)).map(toCatalogItem);
}
