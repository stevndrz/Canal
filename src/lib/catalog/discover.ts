import { fetchList, fetchPagina, searchTitles, type TmdbListEntry } from "./tmdb";
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
  pagina = 1
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
    const { entradas, totalPaginas } = await pedir("movie", MOVIE_BASE);
    return { items: entradas.map(toCatalogItem), pagina, totalPaginas };
  }
  if (tipo === "tv") {
    const { entradas, totalPaginas } = await pedir("tv", TV_BASE);
    return { items: entradas.map(toCatalogItem), pagina, totalPaginas };
  }

  const [pelis, series] = await Promise.all([
    pedir("movie", MOVIE_BASE),
    pedir("tv", TV_BASE),
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

/** Igual, pero con el recuento de páginas para poder seguir buscando. */
export async function searchCatalogPagina(query: string, pagina = 1): Promise<PaginaCatalogo> {
  const term = query.trim();
  if (!term) return { items: [], pagina, totalPaginas: 0 };
  const { entradas, totalPaginas } = await fetchPagina(
    `/search/multi?query=${encodeURIComponent(term)}&include_adult=false&page=${pagina}`,
    "movie"
  );
  return {
    // `/search/multi` mezcla personas, que no encajan en ninguna ficha.
    items: entradas.filter((e) => e.mediaType === "movie" || e.mediaType === "tv").map(toCatalogItem),
    pagina,
    totalPaginas,
  };
}
