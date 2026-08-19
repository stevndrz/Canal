import type { MediaType } from "./types";

/**
 * Cliente mínimo de TMDB.
 *
 * Todo aquí es opcional por diseño: si no hay clave configurada o TMDB no
 * responde, cada función devuelve `null` y la interfaz se queda con lo que
 * haya en `src/data/catalog.json`. La sección nunca debe romperse por una API
 * externa.
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
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  seasons?: { season_number: number; episode_count: number }[];
}

interface TmdbSeason {
  episodes?: {
    episode_number: number;
    name?: string;
    overview?: string;
    still_path?: string | null;
  }[];
}

async function tmdbFetch<T>(path: string): Promise<T | null> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `${TMDB_API}${path}${path.includes("?") ? "&" : "?"}api_key=${apiKey}&language=es-MX`;
    // Un día de caché: el reparto de una película no cambia cada hora.
    const response = await fetch(url, { next: { revalidate: 86400 } });
    if (!response.ok) {
      console.error(`❌ TMDB respondió HTTP ${response.status} en ${path}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error("❌ Error consultando TMDB:", error);
    return null;
  }
}

export interface TmdbTitleData {
  title: string | null;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  year: string | null;
  rating: number | null;
  seasons: number[];
}

export async function fetchTitle(tmdbId: number, mediaType: MediaType): Promise<TmdbTitleData | null> {
  const data = await tmdbFetch<TmdbTitle>(`/${mediaType}/${tmdbId}`);
  if (!data) return null;

  const date = data.release_date || data.first_air_date || "";
  return {
    title: data.title ?? data.name ?? null,
    overview: data.overview ?? "",
    poster: tmdbImage(data.poster_path, POSTER_SIZE),
    backdrop: tmdbImage(data.backdrop_path, BACKDROP_SIZE),
    year: date ? date.slice(0, 4) : null,
    rating: typeof data.vote_average === "number" ? Math.round(data.vote_average * 10) / 10 : null,
    // La temporada 0 son los especiales; se omite para no confundir.
    seasons: (data.seasons ?? [])
      .filter((season) => season.season_number > 0 && season.episode_count > 0)
      .map((season) => season.season_number),
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

export function isTmdbConfigured(): boolean {
  return Boolean(process.env.TMDB_API_KEY);
}
