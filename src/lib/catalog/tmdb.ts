import type { MediaType } from "./types";
import { serverConfig } from "@/lib/config";

/**
 * Cliente mínimo de TMDB.
 *
 * Todo aquí es opcional por diseño: si TMDB no responde o la clave deja de
 * valer, cada función devuelve `null` (o una lista vacía) y la interfaz se
 * queda con lo que haya en `src/data/catalog.json`. La sección nunca debe
 * romperse por una API externa.
 */

const TMDB_API = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

/** Se piden ya en el tamaño final: sin optimizador y sin gastar RAM de más. */
export const POSTER_SIZE = "w342";
export const BACKDROP_SIZE = "w1280";
export const STILL_SIZE = "w300";

export function tmdbImage(path: string | null | undefined, size: string): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

interface TmdbTitle {
  title?: string;
  /** Llega solo con `append_to_response=…,external_ids`. */
  external_ids?: { imdb_id?: string | null };
  original_language?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  seasons?: { season_number: number; episode_count: number }[];
  tagline?: string;
  /** Películas. */
  runtime?: number | null;
  /** Series: duración típica de un episodio, en minutos. */
  episode_run_time?: number[];
  genres?: { id: number; name: string }[];
  /** Series. La dirección de una película va en `credits.crew`. */
  created_by?: { name: string }[];
  /** Llega solo con `append_to_response=credits`. */
  credits?: {
    cast?: { name: string; character?: string; profile_path?: string | null }[];
    crew?: { name: string; job?: string }[];
  };
}

interface TmdbSeason {
  episodes?: {
    episode_number: number;
    name?: string;
    overview?: string;
    still_path?: string | null;
  }[];
}

/**
 * Tope de espera, por la misma razón que en la lista M3U y la guía EPG: una
 * API externa lenta no debe poder agotar el tiempo de la función y dejar la
 * página sin pintar. Sin clave o sin respuesta, la sección usa el catálogo
 * local.
 */
const TMDB_TIMEOUT_MS = 5000;

function tmdbCredential(): string {
  return serverConfig().tmdbCredencial;
}

async function tmdbFetch<T>(path: string): Promise<T | null> {
  const credential = tmdbCredential();
  if (!credential) return null;

  // TMDB reparte dos credenciales distintas en la misma pantalla de ajustes y
  // es fácil copiar la que no es. La v4 ("API Read Access Token") es un JWT y
  // va en la cabecera; la v3 ("API Key") va en la URL. Los endpoints /3
  // aceptan las dos, así que se detecta cuál pegaron en vez de exigir una.
  const isReadAccessToken = credential.startsWith("eyJ");

  try {
    const url =
      `${TMDB_API}${path}${path.includes("?") ? "&" : "?"}language=es-MX` +
      (isReadAccessToken ? "" : `&api_key=${encodeURIComponent(credential)}`);
    // Un día de caché: el reparto de una película no cambia cada hora.
    const response = await fetch(url, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
      headers: isReadAccessToken ? { Authorization: `Bearer ${credential}` } : undefined,
    });
    if (!response.ok) {
      const hint =
        response.status === 401
          ? " — revisa TMDB_API_KEY (sirve la API Key v3 o el API Read Access Token v4)"
          : "";
      console.error(`❌ TMDB respondió HTTP ${response.status} en ${path}${hint}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? `no respondió en ${TMDB_TIMEOUT_MS / 1000}s`
        : String(error);
    console.error(`❌ Error consultando TMDB (${reason}) — ${path}`);
    return null;
  }
}

/** Una persona del reparto, ya lista para pintar. */
export interface TmdbPersona {
  nombre: string;
  personaje: string;
  foto: string | null;
}

export interface TmdbTitleData {
  title: string | null;
  /**
   * Id de IMDB («tt…»), que consumen los servidores que indexan por él.
   * Nunca sale hacia el cliente: es dato interno del servidor.
   */
  imdbId: string | null;
  /** Idioma en que se rodó (`es`, `en`…). Ver ResolvedCatalogItem. */
  originalLanguage: string | null;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  year: string | null;
  rating: number | null;
  seasons: number[];
  /** Frase de cartel. Vacía en la mayoría de títulos, y eso está bien. */
  tagline: string;
  /** Minutos. En una serie, la duración típica de un episodio. */
  duracion: number | null;
  generos: string[];
  reparto: TmdbPersona[];
  /** Dirección en películas; creación en series. */
  autoria: string[];
}

/**
 * Ficha completa en **una sola petición**.
 *
 * `append_to_response=credits` trae el reparto en la misma llamada en lugar de
 * en otra: TMDB lo cuenta como una, y una ficha que ya tarda no debería tardar
 * el doble por enseñar quién sale.
 */
export async function fetchTitle(tmdbId: number, mediaType: MediaType): Promise<TmdbTitleData | null> {
  const data = await tmdbFetch<TmdbTitle>(`/${mediaType}/${tmdbId}?append_to_response=credits,external_ids`);
  if (!data) return null;

  const date = data.release_date || data.first_air_date || "";

  // En películas la autoría es la dirección; en series, la creación. TMDB las
  // guarda en sitios distintos, así que se mira en los dos.
  const autoria = [
    ...(data.created_by ?? []).map((persona) => persona.name),
    ...(data.credits?.crew ?? [])
      .filter((persona) => persona.job === "Director")
      .map((persona) => persona.name),
  ].filter((nombre, indice, lista) => nombre && lista.indexOf(nombre) === indice);

  return {
    title: data.title ?? data.name ?? null,
    imdbId: data.external_ids?.imdb_id ?? null,
    originalLanguage: data.original_language ?? null,
    overview: data.overview ?? "",
    poster: tmdbImage(data.poster_path, POSTER_SIZE),
    backdrop: tmdbImage(data.backdrop_path, BACKDROP_SIZE),
    year: date ? date.slice(0, 4) : null,
    rating: typeof data.vote_average === "number" ? Math.round(data.vote_average * 10) / 10 : null,
    // La temporada 0 son los especiales; se omite para no confundir.
    seasons: (data.seasons ?? [])
      .filter((season) => season.season_number > 0 && season.episode_count > 0)
      .map((season) => season.season_number),
    tagline: data.tagline ?? "",
    duracion: data.runtime ?? data.episode_run_time?.[0] ?? null,
    generos: (data.genres ?? []).map((genero) => genero.name),
    // Doce caben en un carril sin que haya que recorrerlo entero; más allá del
    // duodécimo nombre ya nadie está buscando a nadie.
    reparto: (data.credits?.cast ?? []).slice(0, 12).map((persona) => ({
      nombre: persona.name,
      personaje: persona.character ?? "",
      foto: tmdbImage(persona.profile_path, POSTER_SIZE),
    })),
    autoria: autoria.slice(0, 3),
  };
}

export interface TmdbEpisodeData {
  episode: number;
  title: string | null;
  overview: string;
  still: string | null;
}

export async function fetchSeason(tmdbId: number, season: number): Promise<TmdbEpisodeData[] | null> {
  const data = await tmdbFetch<TmdbSeason>(`/tv/${tmdbId}/season/${season}`);
  if (!data?.episodes) return null;

  return data.episodes.map((episode) => ({
    episode: episode.episode_number,
    title: episode.name ?? null,
    overview: episode.overview ?? "",
    still: tmdbImage(episode.still_path, STILL_SIZE),
  }));
}

/** Una ficha tal y como viene en una lista (discover, trending, búsqueda). */
interface TmdbListItem {
  id: number;
  original_language?: string;
  media_type?: string;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
}

interface TmdbListResponse {
  results?: TmdbListItem[];
  total_pages?: number;
}

export interface TmdbListEntry {
  tmdbId: number;
  originalLanguage: string | null;
  mediaType: MediaType;
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  year: string | null;
  rating: number | null;
}

/**
 * Convierte un resultado de lista en ficha.
 *
 * Merece la pena porque estas respuestas **ya traen título, póster, sinopsis,
 * año y nota**: pintar una fila cuesta una sola petición en vez de una por
 * ficha. Con diez filas de veinte, son doscientas peticiones menos por visita.
 *
 * `fallbackType` es para `/discover`, que no devuelve `media_type` porque el
 * tipo ya va en la URL; `/trending` y `/search/multi` sí lo mandan y mezclan.
 */
function toListEntry(item: TmdbListItem, fallbackType: MediaType): TmdbListEntry | null {
  const mediaType: MediaType =
    item.media_type === "movie" || item.media_type === "tv" ? item.media_type : fallbackType;

  const title = item.title ?? item.name ?? "";
  // Sin póster la fila se ve rota, y sin título no hay nada que enseñar.
  if (!title || !item.poster_path) return null;

  const date = item.release_date || item.first_air_date || "";
  return {
    tmdbId: item.id,
    mediaType,
    originalLanguage: item.original_language ?? null,
    title,
    overview: item.overview ?? "",
    poster: tmdbImage(item.poster_path, POSTER_SIZE),
    backdrop: tmdbImage(item.backdrop_path, BACKDROP_SIZE),
    year: date ? date.slice(0, 4) : null,
    rating: typeof item.vote_average === "number" ? Math.round(item.vote_average * 10) / 10 : null,
  };
}

/** Una página de resultados, con cuántas hay en total. */
export interface TmdbPagina {
  entradas: TmdbListEntry[];
  /**
   * Páginas disponibles, ya acotadas a lo que TMDB sirve de verdad.
   *
   * Su API dice `total_pages` en miles, pero **rechaza cualquier página por
   * encima de 500**: pedir la 501 devuelve un error, no una lista vacía. Sin
   * acotar aquí, el paginador ofrecería miles de páginas y todas menos las
   * 500 primeras darían error.
   */
  totalPaginas: number;
}

/** Una lista de TMDB (discover/trending). Sin clave o sin respuesta, vacía. */
export async function fetchList(path: string, fallbackType: MediaType): Promise<TmdbListEntry[]> {
  return (await fetchPagina(path, fallbackType)).entradas;
}

/**
 * Igual que `fetchList`, pero diciendo además cuántas páginas hay.
 *
 * Se separa en vez de cambiar `fetchList` porque las filas de la portada no
 * paginan —son una selección, no un listado— y añadirles el recuento sería
 * cargarlas con algo que no usan.
 */
export async function fetchPagina(path: string, fallbackType: MediaType): Promise<TmdbPagina> {
  const data = await tmdbFetch<TmdbListResponse>(path);
  if (!data?.results) return { entradas: [], totalPaginas: 0 };
  return {
    entradas: data.results
      .map((item) => toListEntry(item, fallbackType))
      .filter((entry): entry is TmdbListEntry => entry !== null),
    totalPaginas: Math.min(data.total_pages ?? 1, TOPE_PAGINAS_TMDB),
  };
}

/** Ver `TmdbPagina.totalPaginas`. */
const TOPE_PAGINAS_TMDB = 500;

/**
 * Busca en todo el catálogo de TMDB. Devuelve el título en español aunque la
 * película sea en inglés (`Batman Begins` -> `Batman inicia`), que es lo que
 * hace utilizable un catálogo internacional en casa.
 */
export async function searchTitles(query: string): Promise<TmdbListEntry[]> {
  const term = query.trim();
  if (!term) return [];
  // `/search/multi` mezcla películas, series y personas; las personas se caen
  // solas al no encajar en el tipo, pero se filtran antes para no perder sitio.
  const data = await tmdbFetch<TmdbListResponse>(
    `/search/multi?query=${encodeURIComponent(term)}&include_adult=false`
  );
  if (!data?.results) return [];
  return data.results
    .filter((item) => item.media_type === "movie" || item.media_type === "tv")
    .map((item) => toListEntry(item, "movie"))
    .filter((entry): entry is TmdbListEntry => entry !== null);
}

export interface TmdbGenre {
  id: number;
  name: string;
}

/**
 * Géneros disponibles para un tipo, ya en español (`tmdbFetch` manda `es-MX`).
 *
 * Hay que pedirlos por separado porque las dos listas NO son la misma, aunque
 * lo parezca: en series no existe Terror, y Acción es 10759 ("Action &
 * Adventure") en vez del 28 de películas. Usar la lista de películas para
 * series devuelve resultados vacíos sin decir por qué.
 */
export async function fetchGenres(mediaType: MediaType): Promise<TmdbGenre[]> {
  const data = await tmdbFetch<{ genres?: TmdbGenre[] }>(`/genre/${mediaType}/list`);
  return data?.genres ?? [];
}

export function isTmdbConfigured(): boolean {
  // Mismo criterio que tmdbFetch(), incluida la clave de reserva: si no
  // coincidieran, saldría el aviso de "falta la clave" con el catálogo lleno.
  return Boolean(tmdbCredential());
}
