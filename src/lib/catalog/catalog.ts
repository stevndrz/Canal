import catalogData from "@/data/catalog.json";
import { fetchCatalogRows, tmdbIdFromCatalogId } from "./discover";
import { fetchSeason, fetchTitle, isTmdbConfigured } from "./tmdb";
import { estadoDelCatalogo, type EstadoCatalogo } from "./estado";
import type {
  CatalogItem,
  CatalogSection,
  MediaType,
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
  return (await resolverFicha(item)).ficha;
}

/**
 * Como `resolveItem`, pero diciendo si de verdad se encontró el título.
 *
 * Un id `tmdb-N` cualquiera se acepta sin preguntar (ver `findCatalogItem`), y
 * si TMDB no lo tiene —o no contesta— la ficha salía titulada «Sin título»,
 * con un reproductor buscando algo que no existe. Sin título propio en
 * `catalog.json` y sin respuesta de TMDB, no hay nada que enseñar: la página
 * dice «No encontramos este título» y ofrece volver.
 */
export async function resolverFicha(
  item: CatalogItem,
): Promise<{ ficha: ResolvedCatalogItem; encontrada: boolean }> {
  const tmdb = item.tmdbId ? await fetchTitle(item.tmdbId, item.mediaType) : null;
  const encontrada = Boolean(item.title || tmdb?.title);
  return { ficha: combinar(item, tmdb), encontrada };
}

function combinar(
  item: CatalogItem,
  tmdb: Awaited<ReturnType<typeof fetchTitle>>,
): ResolvedCatalogItem {
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
    tagline: tmdb?.tagline ?? "",
    duracion: tmdb?.duracion ?? null,
    generos: tmdb?.generos ?? [],
    reparto: tmdb?.reparto ?? [],
    autoria: tmdb?.autoria ?? [],
    imdbId: tmdb?.imdbId ?? null,
    trailerUrl: tmdb?.trailerUrl ?? null,
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
function groupByCollection(items: ResolvedCatalogItem[]): CatalogSection[] {
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
 *
 * Inicio la sigue usando tal cual —solo quiere las filas, y sin catálogo se
 * queda con los canales—; `/peliculas` usa `getCatalogo`, que además dice
 * POR QUÉ está vacío.
 */
export async function getCatalogSections(): Promise<CatalogSection[]> {
  return (await getCatalogo()).filas;
}

/**
 * La pista para quien despliega va al registro del servidor, no a la
 * pantalla de quien mira: a la familia «falta TMDB_API_KEY» no le dice nada,
 * y en producción era un aviso amarillo de desarrollador en mitad del
 * catálogo. Aquí lo ve quien puede arreglarlo.
 *
 * Una vez por proceso y no en cada visita: Inicio también pide el catálogo,
 * y repetirlo en cada carga enterraba el resto del registro (y en `next dev`
 * encendía el aviso de errores en todas las pantallas).
 */
let sinClaveAvisado = false;
function avisarSinClave() {
  if (sinClaveAvisado) return;
  sinClaveAvisado = true;
  console.error("❌ Cine y series sin catálogo: falta TMDB_API_KEY (o títulos en src/data/catalog.json).");
}

export interface Catalogo {
  filas: CatalogSection[];
  estado: EstadoCatalogo;
}

/**
 * Las filas y el estado del catálogo. Ver `estado.ts` para qué significa cada
 * estado y por qué una lista vacía no bastaba para decirlo.
 */
export async function getCatalogo(): Promise<Catalogo> {
  const configurado = isTmdbConfigured();
  const [own, rows] = await Promise.all([resolveCatalog(), fetchCatalogRows()]);
  const estado = estadoDelCatalogo({
    configurado,
    filasConTitulos: rows.length,
    propias: own.length,
  });

  if (estado === "sin-configurar") avisarSinClave();

  return { filas: [...groupByCollection(own), ...rows], estado };
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
