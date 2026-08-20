import catalogData from "@/data/catalog.json";
import { fetchCatalogRows, tmdbIdFromCatalogId } from "./discover";
import { fetchSeason, fetchTitle } from "./tmdb";
import type {
  CatalogItem,
  CatalogSection,
  MediaType,
  PlaybackSource,
  ResolvedCatalogItem,
  ResolvedEpisode,
} from "./types";

/**
 * Combina el catálogo escrito a mano con los metadatos de TMDB.
 *
 * Regla en todo el módulo: **lo que el usuario escribe en catalog.json manda**.
 * TMDB solo rellena huecos. Así se puede corregir un título o poner el póster
 * de un doblaje concreto sin pelearse con la API.
 */

const catalog = catalogData as CatalogItem[];

export function getCatalog(): CatalogItem[] {
  return catalog;
}

export function findCatalogItem(mediaType: MediaType, id: string): CatalogItem | null {
  const own = catalog.find((item) => item.id === id && item.mediaType === mediaType);
  if (own) return own;

  // Las fichas que vienen de TMDB no están en el JSON: son miles y cambian
  // solas. Se reconstruyen a partir del id (`tmdb-550`), que es todo lo que
  // hace falta para pedir los datos y armar la URL del reproductor. Sin esto,
  // cada tarjeta del catálogo daría 404 al abrirla.
  const tmdbId = tmdbIdFromCatalogId(id);
  return tmdbId ? { id, mediaType, tmdbId, source: { kind: "embed" } } : null;
}

/** Ficha lista para pintar: JSON por encima, TMDB de relleno. */
export async function resolveItem(item: CatalogItem): Promise<ResolvedCatalogItem> {
  const tmdb = item.tmdbId ? await fetchTitle(item.tmdbId, item.mediaType) : null;

  return {
    ...item,
    title: item.title ?? tmdb?.title ?? "Sin título",
    poster: item.poster ?? tmdb?.poster ?? null,
    overview: item.overview ?? tmdb?.overview ?? "",
    backdrop: tmdb?.backdrop ?? null,
    year: tmdb?.year ?? null,
    rating: tmdb?.rating ?? null,
    originalLanguage: tmdb?.originalLanguage ?? null,
    seasons: tmdb?.seasons ?? seasonsFromOverrides(item),
  };
}

/** Sin TMDB, las temporadas salen de los episodios escritos a mano. */
function seasonsFromOverrides(item: CatalogItem): number[] {
  const seasons = new Set((item.episodes ?? []).map((episode) => episode.season));
  return Array.from(seasons).sort((a, b) => a - b);
}

export async function resolveCatalog(): Promise<ResolvedCatalogItem[]> {
  // En paralelo: son pocas fichas y TMDB ya viene cacheada un día.
  return Promise.all(catalog.map(resolveItem));
}

/** Agrupa por `collection` conservando el orden de aparición en el JSON. */
export function groupByCollection(items: ResolvedCatalogItem[]): CatalogSection[] {
  const groups = new Map<string, ResolvedCatalogItem[]>();
  for (const item of items) {
    const key = item.collection?.trim() || "Destacados";
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return Array.from(groups, ([title, groupItems]) => ({ title, items: groupItems }));
}

/**
 * Todo lo que se pinta en /peliculas: primero lo escrito a mano, después el
 * catálogo de TMDB.
 *
 * El orden no es casual y es el mismo criterio de todo el módulo: **lo que tú
 * escribes manda**, así que tus colecciones salen arriba y el catálogo
 * automático va debajo, sin poder desplazarlas.
 */
export async function getCatalogSections(): Promise<CatalogSection[]> {
  const [own, rows] = await Promise.all([resolveCatalog(), fetchCatalogRows()]);
  return [...groupByCollection(own), ...rows];
}

/**
 * Episodios de una temporada. TMDB pone la estructura; el JSON puede
 * sobrescribir título, sinopsis o la fuente de cualquier episodio suelto.
 */
export async function resolveSeason(item: CatalogItem, season: number): Promise<ResolvedEpisode[]> {
  const overrides = new Map(
    (item.episodes ?? [])
      .filter((episode) => episode.season === season)
      .map((episode) => [episode.episode, episode])
  );

  const fromTmdb = item.tmdbId ? await fetchSeason(item.tmdbId, season) : null;

  if (fromTmdb) {
    return fromTmdb.map((episode) => {
      const override = overrides.get(episode.episode);
      return {
        season,
        episode: episode.episode,
        title: override?.title ?? episode.title ?? `Episodio ${episode.episode}`,
        overview: override?.overview ?? episode.overview,
        still: episode.still,
        source: override?.source ?? item.source,
      };
    });
  }

  // Sin TMDB solo se listan los episodios escritos a mano.
  return Array.from(overrides.values())
    .sort((a, b) => a.episode - b.episode)
    .map((episode) => ({
      season,
      episode: episode.episode,
      title: episode.title ?? `Episodio ${episode.episode}`,
      overview: episode.overview ?? "",
      still: null,
      source: episode.source ?? item.source,
    }));
}

export function isManual(source: PlaybackSource): source is Extract<PlaybackSource, { kind: "manual" }> {
  return source.kind === "manual";
}
