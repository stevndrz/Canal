import * as iptvParser from "iptv-playlist-parser";
import { classifyChannel, compareByCategory } from "./categories";
import { normalizeText } from "./text";
import { findLogoUrl } from "./logos";
import type { ParsedChannel } from "./types";

const DEFAULT_M3U_URL =
  "https://gist.githubusercontent.com/stevndrz/08bf27100aa1bd5fd518aa5b4e548b4f/raw/a46e30eeda0b2c319eed0cc6d2b8877b97f19207/gt.m3u";

export interface M3uPlaylist {
  channels: ParsedChannel[];
  epgUrl: string | null;
}

/** Forma laxa: cada lista M3U trae un subconjunto distinto de atributos. */
type RawM3uChannel = {
  name?: string;
  title?: string;
  url?: string;
  logo?: string;
  group?: string | { title?: string };
  tvg?: {
    id?: string;
    name?: string;
    logo?: string;
    language?: string;
    country?: string;
  };
};

const ADULT_CONTENT = /\b(xxx|adult|porn|erotic|erotico|hentai|playboy)\b/i;

/**
 * Tope de espera al descargar la lista. Sin él, un origen que no responde deja
 * la petición colgada hasta que la plataforma corta la función entera y la
 * página no llega a pintarse.
 */
const M3U_TIMEOUT_MS = 8000;

/** Cuánto se reutiliza la lista ya interpretada antes de volver a descargarla. */
const PLAYLIST_CACHE_MS = 5 * 60 * 1000;

export function getM3uSourceUrl(): string {
  return process.env.M3U_URL || DEFAULT_M3U_URL;
}

export async function fetchM3uText(): Promise<string | null> {
  const source = getM3uSourceUrl();
  try {
    // `no-store` a propósito: la caché de datos de Next descarta respuestas de
    // más de 2 MB, y estas listas las superan de largo. El almacenamiento lo
    // hace loadM3uPlaylist(), que además evita volver a descargar.
    const response = await fetch(source, {
      cache: "no-store",
      signal: AbortSignal.timeout(M3U_TIMEOUT_MS),
    });
    if (response.ok) return await response.text();
    console.error(`❌ La lista M3U respondió HTTP ${response.status} — ${source}`);
  } catch (error) {
    const reason = error instanceof Error && error.name === "TimeoutError"
      ? `no respondió en ${M3U_TIMEOUT_MS / 1000}s`
      : String(error);
    console.error(`❌ Error descargando la lista M3U (${reason}) — ${source}`);
  }
  return null;
}

/**
 * Algunas listas referencian su guía de programación (EPG XMLTV) en la primera
 * línea: `#EXTM3U url-tvg="https://.../epg.xml.gz"`.
 */
export function extractEpgUrl(m3uText: string): string | null {
  const headerLine = m3uText.split("\n", 1)[0] ?? "";
  const match = headerLine.match(/\b(?:url-tvg|x-tvg-url|tvg-url)="([^"]+)"/i);
  if (!match) return null;
  // Varias URLs separadas por coma: usamos la primera.
  return match[1].split(",")[0]?.trim() || null;
}

function getParser() {
  return (
    iptvParser.parse ||
    (iptvParser as unknown as { default?: typeof iptvParser.parse }).default ||
    iptvParser
  );
}

function getGroupTitle(item: RawM3uChannel): string {
  if (typeof item.group === "string") return item.group;
  return item.group?.title ?? "";
}

/** Etiquetas de calidad/códec que las listas pegan al final del nombre. */
const QUALITY_TAG = /(?:fhd|uhd|4k|8k|hd|sd|hevc|h\.?26[45]|x26[45]|av1|\d{2,3}\s?fps)/;

/**
 * Quita sufijos de calidad y notas del nombre, ej.
 * `BBC Persian (720p) (HEVC) [Not 24/7]` -> `BBC Persian`. Se repite porque
 * suelen venir apilados.
 */
export function cleanChannelName(rawName: string): string {
  let result = rawName.trim();
  let previous: string;
  do {
    previous = result;
    result = result
      .replace(/\s*\[[^\]]*\]\s*$/, "")
      .replace(new RegExp(`[\\s([-]*\\b${QUALITY_TAG.source}\\b[\\s)\\]-]*$`, "i"), "")
      .replace(/[\s([-]*\d{3,4}p[\s)\]-]*$/i, "")
      .trim();
  } while (result !== previous && result.length > 0);
  return result || rawName.trim();
}

/**
 * Los `tvg-id` estilo iptv-org codifican el país del canal:
 * `Canal3.gt@SD` -> `gt`, `00sReplay.us@SD` -> `us`. Es una señal mucho más
 * fiable que adivinar por el nombre, sobre todo para distinguir el "Canal 3"
 * de Guatemala del de Argentina.
 */
export function countryFromTvgId(tvgId: string): string {
  const match = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
  return match ? match[1].toLowerCase() : "";
}

function getDeduplicationKey(item: RawM3uChannel): string {
  const streamUrl = item.url?.trim();
  if (streamUrl) return `url:${streamUrl}`;
  const tvgId = item.tvg?.id?.trim();
  if (tvgId) return `tvg:${normalizeText(tvgId)}`;
  return `name:${normalizeText(item.name || item.title || "")}`;
}

// Un Collator reutilizado en vez de String.localeCompare: con listas de más de
// 10.000 canales la diferencia es de ~1300 ms a ~50 ms, porque localeCompare
// reconstruye el colador en cada comparación.
const nameCollator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

function sortChannels(channels: ParsedChannel[]): ParsedChannel[] {
  return [...channels].sort((a, b) => {
    const byCategory = compareByCategory(a.category, b.category);
    if (byCategory !== 0) return byCategory;
    return nameCollator.compare(a.name, b.name);
  });
}

export function parseM3uChannels(m3uText: string): ParsedChannel[] {
  let parsed: unknown;
  try {
    parsed = getParser()(m3uText);
  } catch (error) {
    console.error("❌ Error interpretando la lista M3U:", error);
    return [];
  }

  const rawChannels =
    (parsed as { channels?: RawM3uChannel[] })?.channels ||
    (parsed as { items?: RawM3uChannel[] })?.items ||
    [];
  if (!Array.isArray(rawChannels)) return [];

  const unique = new Map<string, RawM3uChannel>();
  for (const item of rawChannels) {
    if (!item?.url) continue;
    if (ADULT_CONTENT.test(`${item.name || item.title || ""} ${getGroupTitle(item)}`)) continue;
    const key = getDeduplicationKey(item);
    if (!unique.has(key)) unique.set(key, item);
  }

  const channels = Array.from(unique.values()).map<ParsedChannel>((item, index) => {
    const name = cleanChannelName(item.name || item.title || item.tvg?.name || `Canal ${index + 1}`);
    const group = getGroupTitle(item);
    const tvgId = item.tvg?.id?.trim() ?? "";
    // El logo de la lista manda; si no trae, se busca por nombre en el índice local.
    const logoUrl = item.tvg?.logo || item.logo || findLogoUrl(name);

    return {
      name,
      category: classifyChannel({
        name,
        group,
        country: item.tvg?.country || countryFromTvgId(tvgId),
        language: item.tvg?.language ?? "",
      }),
      logoText: name.slice(0, 2).toUpperCase(),
      logoUrl,
      streamUrl: item.url ?? "",
      tvgId,
    };
  });

  return sortChannels(channels);
}

/**
 * Lista ya descargada e interpretada, guardada en memoria del proceso.
 *
 * La caducidad es por tiempo y no por contenido: comparar el texto obligaba a
 * descargar los 3 MB en cada visita solo para descubrir que no había cambiado.
 * Así, dentro de la ventana no se toca la red siquiera.
 */
let cachedPlaylist: { source: string; playlist: M3uPlaylist; expiresAt: number } | null = null;

export async function loadM3uPlaylist(): Promise<M3uPlaylist> {
  const source = getM3uSourceUrl();
  const fresh = cachedPlaylist?.source === source && cachedPlaylist.expiresAt > Date.now();
  if (fresh && cachedPlaylist) return cachedPlaylist.playlist;

  const m3uText = await fetchM3uText();

  if (!m3uText) {
    // Antes que dejar la guía vacía, se sirve la última lista buena aunque
    // haya caducado: que GitHub tenga un mal momento no debe apagar la TV.
    if (cachedPlaylist?.source === source) {
      console.warn("⚠️ Fallo al refrescar la lista M3U; se sirve la última copia buena.");
      return cachedPlaylist.playlist;
    }
    return { channels: [], epgUrl: null };
  }

  const playlist: M3uPlaylist = {
    channels: parseM3uChannels(m3uText),
    epgUrl: extractEpgUrl(m3uText),
  };
  cachedPlaylist = { source, playlist, expiresAt: Date.now() + PLAYLIST_CACHE_MS };
  return playlist;
}
