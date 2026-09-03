import "server-only";

import type { MediaType } from "./types";
import { cacheLife } from "next/cache";
import { serverConfig } from "@/lib/config.server";

/**
 * Cliente mínimo de TMDB. Todo es opcional por diseño: sin respuesta o sin
 * clave válida cada función devuelve `null` o lista vacía y la interfaz se
 * queda con `src/data/catalog.json`. Nunca un 500 por una API externa.
 */

/**
 * La base es sustituible por entorno (`TMDB_API_BASE`) para pruebas —simular
 * lentitud o caídas sin tocar producción— y para quien accede a la API desde
 * un espejo. El defecto es la API pública.
 *
 * Se pide a `serverConfig()` y no a `process.env`: es la regla del proyecto, y
 * aquí además hay un motivo concreto — la credencial viaja a donde esto diga,
 * así que conviene que se lea y se valide en el archivo donde se revisan las
 * credenciales. Es una función y no una constante de módulo porque el valor se
 * evalúa por petición, igual que el resto de `serverConfig()`.
 */
function baseTmdb(): string {
  return serverConfig().tmdbApiBase;
}

const IMAGE_BASE = "https://image.tmdb.org/t/p";

/**
 * En el tamaño final, sin optimizador. Medido con `curl`, no a ojo:
 *
 *     póster    w342 → 43 KB    w780 → 171 KB    original → 1,35 MB
 *     fondo     w780 → 43 KB   w1280 → 173 KB    original → 1,24 MB
 *
 * `w780` para una tarjeta de 180-240px no es solo red: son **3,6 MB de RGBA en
 * memoria** ya descodificado, e Inicio pinta 200 pósters en un televisor que
 * tiene 1-1,5 GB para todo.
 */
export const POSTER_SIZE = "w342";
export const BACKDROP_SIZE = "w1280";
/** Retratos del reparto: doce por ficha; `w780` sería peso muerto. */
export const PROFILE_SIZE = "w342";
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
  /** Llega solo con `append_to_response=videos`. */
  videos?: { results?: TmdbVideo[] };
}

interface TmdbVideo {
  type?: string;
  site?: string;
  key?: string;
}

/**
 * El primer tráiler de YouTube de una lista de vídeos, o ninguno.
 *
 * TMDB mezcla tráilers, teasers, clips y detrás-de-cámaras sin distinguir
 * cuál es «el» tráiler; el primero que cumpla `Trailer`+`YouTube` es la mejor
 * aproximación sin adivinar más de la cuenta.
 */
function primerTrailer(videos?: TmdbVideo[]): string | null {
  const trailer = videos?.find((video) => video.type === "Trailer" && video.site === "YouTube");
  return trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
}

interface TmdbSeason {
  episodes?: {
    episode_number: number;
    name?: string;
    overview?: string;
    still_path?: string | null;
  }[];
}

/** Una API lenta no debe agotar el tiempo de la función y dejar la página sin pintar. */
const TMDB_TIMEOUT_MS = 5000;

function tmdbCredential(): string {
  return serverConfig().tmdbCredencial;
}

async function tmdbFetch<T>(path: string): Promise<T | null> {
  const credential = tmdbCredential();
  if (!credential) return null;
  return tmdbConClave<T>(path, credential);
}

/**
 * Cacheada como función (`use cache`): bajo `cacheComponents` el
 * `next: { revalidate }` de fetch ya no cachea. La credencial entra como
 * argumento para que la caché de una clave vieja no sirva a la nueva.
 */
async function tmdbConClave<T>(path: string, credential: string): Promise<T | null> {
  "use cache";
  cacheLife("days");

  // TMDB reparte dos credenciales distintas en la misma pantalla de ajustes y
  // es fácil copiar la que no es. La v4 ("API Read Access Token") es un JWT y
  // va en la cabecera; la v3 ("API Key") va en la URL. Los endpoints /3
  // aceptan las dos, así que se detecta cuál pegaron en vez de exigir una.
  const isReadAccessToken = credential.startsWith("eyJ");

  try {
    const url =
      `${baseTmdb()}${path}${path.includes("?") ? "&" : "?"}language=es-MX` +
      (isReadAccessToken ? "" : `&api_key=${encodeURIComponent(credential)}`);
    const response = await fetch(url, {
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
   * Id de IMDB («tt…»). Lo consumen los servidores que indexan por él, y
   * también se enseña en la ficha como enlace «Ver en IMDB» — ver
   * `ficha-columnas.tsx`.
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
  /** Enlace a YouTube del primer tráiler, o `null` si TMDB no tiene ninguno. */
  trailerUrl: string | null;
}

/**
 * Ficha completa en **una sola petición**.
 *
 * `append_to_response=credits,external_ids,videos` trae reparto, id de IMDB
 * y vídeos en la misma llamada en lugar de en tres: TMDB lo cuenta como una
 * sola, y una ficha que ya tarda no debería tardar el triple por enseñar
 * quién sale, el enlace a IMDB y el botón del tráiler.
 */
export async function fetchTitle(tmdbId: number, mediaType: MediaType): Promise<TmdbTitleData | null> {
  const data = await tmdbFetch<TmdbTitle>(
    `/${mediaType}/${tmdbId}?append_to_response=credits,external_ids,videos`
  );
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
      foto: tmdbImage(persona.profile_path, PROFILE_SIZE),
    })),
    autoria: autoria.slice(0, 3),
    trailerUrl: primerTrailer(data.videos?.results),
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
 * Convierte un resultado de lista en ficha. Estas respuestas **ya traen
 * título, póster, sinopsis, año y nota**, así que una fila cuesta una petición
 * en vez de veinte: con diez filas, doscientas menos por visita.
 *
 * `fallbackType` es para `/discover`, que no manda `media_type` porque el tipo
 * va en la URL; `/trending` y `/search/multi` sí lo mandan y mezclan.
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
   * Páginas acotadas a lo que TMDB sirve de verdad: dice `total_pages` en
   * miles pero **rechaza por encima de 500** con un error, no con una lista
   * vacía. Sin acotar, el paginador ofrecería miles de páginas rotas.
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

/**
 * Solo el tráiler de un título, en su propia petición.
 *
 * Para la ficha, `fetchTitle` ya lo trae gratis con `append_to_response`. Esto
 * es para el héroe de `/peliculas`: ahí no hace falta el resto de la ficha
 * —reparto, sinopsis, temporadas— solo para un botón que necesita una URL, y
 * pedir la ficha completa de los diez candidatos del héroe habría sido diez
 * peticiones de sobra para uno solo que se enseña.
 */
export async function fetchTrailer(tmdbId: number, mediaType: MediaType): Promise<string | null> {
  const data = await tmdbFetch<{ results?: TmdbVideo[] }>(`/${mediaType}/${tmdbId}/videos`);
  return primerTrailer(data?.results);
}

/**
 * «A la gente que vio esto también le gustó…». Mismo endpoint de lista que
 * discover o trending —una petición trae toda la fila—, así que se puede
 * pedir para cada ficha sin que cueste una petición por título.
 */
export async function fetchRecommendations(mediaType: MediaType, tmdbId: number): Promise<TmdbListEntry[]> {
  return fetchList(`/${mediaType}/${tmdbId}/recommendations`, mediaType);
}

export interface TmdbGenre {
  id: number;
  name: string;
}

/**
 * Géneros de un tipo, ya en español (`tmdbFetch` manda `es-MX`). Se piden por
 * separado porque las listas NO son la misma: en series no existe Terror y
 * Acción es 10759 y no 28. Cruzarlas da resultados vacíos sin decir por qué.
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
