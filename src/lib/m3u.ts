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

export async function fetchM3uText(): Promise<string | null> {
  const source = process.env.M3U_URL || DEFAULT_M3U_URL;
  try {
    const response = await fetch(source, { next: { revalidate: 300 } });
    if (response.ok) return await response.text();
    console.error(`❌ La lista M3U respondió HTTP ${response.status}`);
  } catch (error) {
    console.error("❌ Error descargando la lista M3U:", error);
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
 * Interpretar una lista de más de 10.000 canales cuesta cientos de ms, y el
 * resultado solo cambia cuando cambia la lista. Se guarda en memoria del
 * proceso y se reutiliza mientras el texto descargado sea el mismo, así solo
 * la primera visita tras un cambio paga el costo.
 */
let cachedPlaylist: { source: string; playlist: M3uPlaylist } | null = null;

export async function loadM3uPlaylist(): Promise<M3uPlaylist> {
  const m3uText = await fetchM3uText();
  if (!m3uText) return { channels: [], epgUrl: null };
  if (cachedPlaylist?.source === m3uText) return cachedPlaylist.playlist;

  const playlist: M3uPlaylist = {
    channels: parseM3uChannels(m3uText),
    epgUrl: extractEpgUrl(m3uText),
  };
  cachedPlaylist = { source: m3uText, playlist };
  return playlist;
}
