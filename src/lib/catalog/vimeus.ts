import "server-only";

import { cacheLife } from "next/cache";
import { serverConfig } from "@/lib/config.server";
import { BACKDROP_SIZE, POSTER_SIZE, tmdbImage, type TmdbListEntry } from "./tmdb";

/**
 * La API de listados de Vimeus: qué tiene en latino.
 *
 * Con ella salen dos cosas que el iframe solo no da:
 *   - el riel «Recién llegadas en latino» (lo último que añadió, primero);
 *   - qué episodios de una temporada tiene, para marcarlos en la ficha.
 *
 * La clave (`VIMEUS_API_KEY`) es secreta y solo vive aquí, en el servidor.
 * Sin ella todo esto devuelve vacío y la app sigue igual: Vimeus funciona por
 * iframe con la view key, que es pública.
 *
 * ⚠️ La documentación de Vimeus no coincide con lo que responde de verdad
 * (medido el 2026-11-09): la lista viene en `data.result` y la paginación en
 * `data.pages`, no en `data.movies` / `data.pagination`. Se leen las dos
 * formas por si la arreglan.
 */

const BASE = "https://vimeus.net/api/listing";
const ESPERA_MS = 5_000;

export type TipoVimeus = "movies" | "series" | "animes";

interface ItemCrudo {
  tmdb_id?: unknown;
  title?: unknown;
  show_title?: unknown;
  poster?: unknown;
  backdrop?: unknown;
  season?: unknown;
  episode?: unknown;
}

/** La lista de una respuesta, en cualquiera de sus dos formas. */
export function itemsDe(respuesta: unknown): ItemCrudo[] {
  const datos = (respuesta as { data?: Record<string, unknown> } | null)?.data;
  if (!datos || typeof datos !== "object") return [];
  for (const clave of ["result", "movies", "series", "animes", "episodes"]) {
    const lista = datos[clave];
    if (Array.isArray(lista)) return lista.filter((x): x is ItemCrudo => Boolean(x) && typeof x === "object");
  }
  return [];
}

const ruta = (v: unknown) => (typeof v === "string" && v.startsWith("/") ? v : null);
const entero = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n > 0 ? n : null;
};

/** De la API a lo que pinta una tarjeta del catálogo. */
export function entradasDe(respuesta: unknown, tipo: TipoVimeus): TmdbListEntry[] {
  const vistos = new Set<number>();
  const entradas: TmdbListEntry[] = [];
  for (const item of itemsDe(respuesta)) {
    const tmdbId = entero(item.tmdb_id);
    const titulo = typeof item.title === "string" ? item.title.trim() : "";
    const poster = ruta(item.poster);
    // Sin póster la tarjeta sale en blanco; sin id no hay ficha.
    if (!tmdbId || !titulo || !poster || vistos.has(tmdbId)) continue;
    vistos.add(tmdbId);
    entradas.push({
      tmdbId,
      mediaType: tipo === "movies" ? "movie" : "tv",
      title: titulo.slice(0, 200),
      overview: "",
      poster: tmdbImage(poster, POSTER_SIZE),
      backdrop: tmdbImage(ruta(item.backdrop), BACKDROP_SIZE),
      year: null,
      rating: null,
      originalLanguage: null,
      generoIds: [],
    });
  }
  return entradas;
}

/**
 * Una página de un listado, cacheada (`use cache`). La clave entra como
 * argumento para que la caché de una clave vieja no sirva a la nueva; y,
 * como en `tmdb.ts`, lo bueno se guarda horas (Vimeus añade títulos varias
 * veces al día) y un fallo solo minutos, cada rama justo antes de devolver.
 */
async function listado(camino: string, clave: string): Promise<unknown | null> {
  "use cache";
  try {
    const respuesta = await fetch(`${BASE}/${camino}`, {
      signal: AbortSignal.timeout(ESPERA_MS),
      headers: { "X-API-Key": clave, Accept: "application/json" },
    });
    // 404 es la respuesta de verdad a «¿qué tienes de esta serie?»: nada.
    if (respuesta.status === 404) {
      cacheLife("hours");
      return { data: { result: [] } };
    }
    if (!respuesta.ok) {
      if (respuesta.status === 401) console.error("❌ Vimeus respondió 401: revisa VIMEUS_API_KEY (la API key, no la view key)");
      else console.error(`❌ Vimeus respondió HTTP ${respuesta.status} en ${camino}`);
      cacheLife("minutes");
      return null;
    }
    const datos: unknown = await respuesta.json();
    cacheLife("hours");
    return datos;
  } catch (error) {
    console.error(`❌ Vimeus no respondió (${error instanceof Error ? error.name : error}) — ${camino}`);
    cacheLife("minutes");
    return null;
  }
}

/** Lo último que añadió Vimeus de un tipo, primero lo más nuevo. */
export async function recienLlegadas(tipo: TipoVimeus, cuantas = 20): Promise<TmdbListEntry[]> {
  const clave = serverConfig().vimeusApiKey;
  if (!clave) return [];
  const datos = await listado(`${tipo}?page=1`, clave);
  return datos ? entradasDe(datos, tipo).slice(0, cuantas) : [];
}

/**
 * Los episodios de una temporada que Vimeus tiene, o `null` si no se sabe
 * (sin clave, o la API no respondió). `null` no es «ninguno»: la ficha no
 * marca nada en vez de marcarlo todo como que no está.
 */
export async function episodiosEnLatino(tmdbId: number, temporada: number): Promise<number[] | null> {
  const clave = serverConfig().vimeusApiKey;
  if (!clave) return null;
  const datos = await listado(`episodes?tmdb_id=${tmdbId}&season=${temporada}`, clave);
  if (!datos) return null;
  return episodiosDe(datos, temporada);
}

export function episodiosDe(respuesta: unknown, temporada: number): number[] {
  const numeros = new Set<number>();
  for (const item of itemsDe(respuesta)) {
    if (entero(item.season) !== temporada) continue;
    const episodio = entero(item.episode);
    if (episodio) numeros.add(episodio);
  }
  return [...numeros].sort((a, b) => a - b);
}
