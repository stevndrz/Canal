import { fetchList, fetchPagina, searchTitles, type TmdbListEntry } from "./tmdb";
import type { CatalogSection, MediaType, ResolvedCatalogItem } from "./types";

/**
 * Filas del catálogo servidas por TMDB. El orden de `CATALOG_ROWS` es la
 * prioridad en pantalla, y manda una idea: **lo grande primero**. Encabezan
 * trending y popular GLOBAL, no una selección por idioma — con las filas de
 * español delante arriba solo salían producciones locales con pocos votos.
 *
 * El idioma no se pierde: `tmdbFetch` pide `language=es-MX` siempre, y las
 * filas en español siguen ahí, al final, garantizando audio de verdad.
 */

/** Géneros de TMDB usados abajo (los nombres los devuelve la API en español). */
const GENRE = {
  familia: 10751,
  accion: 28,
  comedia: 35,
  terror: 27,
  animacion: 16,
} as const;

/** Criterio de orden del catálogo, elegible desde la interfaz. */
export type OrdenCatalogo = "populares" | "top" | "recientes";

interface RowSpec {
  title: string;
  path: string;
  /** Tipo que se asume cuando la respuesta no trae `media_type` (discover). */
  mediaType: MediaType;
  /** Id de género de la fila, para armar el enlace a su cuadrilla completa. */
  generoId?: number;
}

/** Solo títulos con cierto respaldo de votos: evita rellenar con lo irrelevante. */
const MOVIE_BASE = "sort_by=popularity.desc&vote_count.gte=200&include_adult=false";
const TV_BASE = "sort_by=popularity.desc&vote_count.gte=100&include_adult=false";
/** El cine hispano tiene menos votos que el de Hollywood; si no, sale casi vacío. */
const ES_MOVIE_BASE = "sort_by=popularity.desc&vote_count.gte=50&include_adult=false";
const ES_TV_BASE = "sort_by=popularity.desc&vote_count.gte=20&include_adult=false";

/**
 * Base de discover por criterio y tipo.
 *
 * «Recientes» exige un piso de votos: por fecha pura TMDB devuelve montones de
 * títulos sin estrenar y sin datos que arruinan la cuadrícula. El de series usa
 * su propio campo de fecha (`first_air_date`), que el endpoint de TV no comparte
 * con el de películas.
 */
const ORDEN_BASES: Record<OrdenCatalogo, { movie: string; tv: string }> = {
  populares: { movie: MOVIE_BASE, tv: TV_BASE },
  top: {
    movie: "sort_by=vote_average.desc&vote_count.gte=400&include_adult=false",
    tv: "sort_by=vote_average.desc&vote_count.gte=200&include_adult=false",
  },
  recientes: {
    movie: "sort_by=primary_release_date.desc&vote_count.gte=60&include_adult=false",
    tv: "sort_by=first_air_date.desc&vote_count.gte=25&include_adult=false",
  },
};

const CATALOG_ROWS: RowSpec[] = [
  // Lo primero que se ve: lo más taquillero y comentado del mundo esta semana.
  { title: "Tendencias de la semana", path: "/trending/all/week", mediaType: "movie" },
  { title: "Películas populares", path: `/discover/movie?${MOVIE_BASE}`, mediaType: "movie" },
  { title: "Series populares", path: `/discover/tv?${TV_BASE}`, mediaType: "tv" },
  {
    title: "Para toda la familia",
    path: `/discover/movie?with_genres=${GENRE.familia}&${MOVIE_BASE}`,
    mediaType: "movie",
    generoId: GENRE.familia,
  },
  {
    title: "Acción",
    path: `/discover/movie?with_genres=${GENRE.accion}&${MOVIE_BASE}`,
    mediaType: "movie",
    generoId: GENRE.accion,
  },
  {
    title: "Comedia",
    path: `/discover/movie?with_genres=${GENRE.comedia}&${MOVIE_BASE}`,
    mediaType: "movie",
    generoId: GENRE.comedia,
  },
  {
    title: "Animación",
    path: `/discover/movie?with_genres=${GENRE.animacion}&${MOVIE_BASE}`,
    mediaType: "movie",
    generoId: GENRE.animacion,
  },
  {
    title: "Terror",
    path: `/discover/movie?with_genres=${GENRE.terror}&${MOVIE_BASE}`,
    mediaType: "movie",
    generoId: GENRE.terror,
  },
  // Al final: garantía de audio en español, no escaparate principal.
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
];

/**
 * Prefijo de los ids que salen de TMDB, para que no puedan chocar con los
 * escritos a mano en catalog.json. La ficha reconstruye el tmdbId a partir de
 * aquí, así que ninguna tarjeta necesita estar dada de alta en el JSON.
 */
const TMDB_ID_PREFIX = "tmdb-";

function toCatalogId(tmdbId: number): string {
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
    // Una fila del catálogo trae lo justo para pintar una tarjeta. El reparto,
    // los géneros y la duración solo se piden al abrir la ficha: hacerlo aquí
    // serían veinte peticiones más por cada fila que se enseña.
    tagline: "",
    duracion: null,
    generos: [],
    reparto: [],
    autoria: [],
  };
}

/**
 * Todas las filas, en paralelo: una petición por fila y cada una cacheada un
 * día. Las que vengan vacías (sin clave, o TMDB caído) se descartan en vez de
 * dejar un hueco con título y nada debajo.
 */
export async function fetchCatalogRows(): Promise<CatalogSection[]> {
  const rows = await Promise.all(
    CATALOG_ROWS.map(async (row) => ({
      title: row.title,
      // Enlace a la cuadrilla completa del género/tipo de la fila: los títulos
      // de las filas son clicables y llevan a «todas las de Acción», etc.
      href: `/peliculas?tipo=${row.mediaType}${row.generoId ? `&genero=${row.generoId}` : ""}`,
      items: (await fetchList(row.path, row.mediaType)).map(toCatalogItem),
    }))
  );
  return rows.filter((row) => row.items.length > 0);
}

/**
 * Catálogo filtrado por tipo y/o género.
 *
 * Con "todo" se piden películas y series a la vez y se intercalan por orden de
 * popularidad, para que la rejilla no salga con todas las películas primero y
 * las series enterradas al final.
 */
export interface PaginaCatalogo {
  items: ResolvedCatalogItem[];
  pagina: number;
  totalPaginas: number;
}

export async function fetchFiltered(
  tipo: "todo" | "movie" | "tv",
  generoId: number | null,
  /** Ids válidos en cada tipo; los conjuntos de TMDB no coinciden. */
  generosValidos?: { movie: Set<number>; tv: Set<number> },
  /**
   * Página pedida. Nada se guarda: cada página se trae de TMDB cuando alguien
   * navega a ella y se descarta al salir. El catálogo entero son cientos de
   * miles de fichas, y almacenarlas obligaría a mantenerlas al día.
   */
  pagina = 1,
  /** Criterio de orden; por defecto el de siempre, popularidad. */
  orden: OrdenCatalogo = "populares"
): Promise<PaginaCatalogo> {
  /**
   * El género solo se manda al tipo donde existe. Sin esto, pedir "Terror" en
   * series devuelve cero: TMDB acepta la consulta pero ese id no pertenece a su
   * lista de series, así que no encaja con nada y el resultado sale vacío sin
   * ninguna pista de por qué.
   */
  const generoPara = (mediaType: MediaType) => {
    if (!generoId) return "";
    if (generosValidos && !generosValidos[mediaType].has(generoId)) return null;
    return `&with_genres=${generoId}`;
  };

  const pedir = async (mediaType: MediaType, base: string) => {
    const genero = generoPara(mediaType);
    if (genero === null) return { entradas: [], totalPaginas: 0 };
    return fetchPagina(`/discover/${mediaType}?${base}${genero}&page=${pagina}`, mediaType);
  };

  if (tipo === "movie") {
    const { entradas, totalPaginas } = await pedir("movie", ORDEN_BASES[orden].movie);
    return { items: entradas.map(toCatalogItem), pagina, totalPaginas };
  }
  if (tipo === "tv") {
    const { entradas, totalPaginas } = await pedir("tv", ORDEN_BASES[orden].tv);
    return { items: entradas.map(toCatalogItem), pagina, totalPaginas };
  }

  const [pelis, series] = await Promise.all([
    pedir("movie", ORDEN_BASES[orden].movie),
    pedir("tv", ORDEN_BASES[orden].tv),
  ]);

  // Intercalado uno a uno: ambas listas ya vienen ordenadas por popularidad.
  const mezclado: ResolvedCatalogItem[] = [];
  for (let i = 0; i < Math.max(pelis.entradas.length, series.entradas.length); i++) {
    if (pelis.entradas[i]) mezclado.push(toCatalogItem(pelis.entradas[i]));
    if (series.entradas[i]) mezclado.push(toCatalogItem(series.entradas[i]));
  }
  // Con las dos mezcladas, se puede pasar de página mientras a alguna le
  // queden: la otra simplemente aporta menos fichas en las últimas.
  return { items: mezclado, pagina, totalPaginas: Math.max(pelis.totalPaginas, series.totalPaginas) };
}

/** Resultados de búsqueda, ya listos para pintar como cualquier otra ficha. */
export async function searchCatalog(query: string): Promise<ResolvedCatalogItem[]> {
  return (await searchTitles(query)).map(toCatalogItem);
}
