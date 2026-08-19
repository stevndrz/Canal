import * as iptvParser from "iptv-playlist-parser";
import gtLogosData from "./gt-logos.json";

export interface ParsedM3uChannel {
  name: string;
  number: string;
  category: string;
  logoText: string;
  logoUrl: string;
  streamUrl: string;
  tvgId: string;
  isFavorite: boolean;
  isLive: boolean;
}

export interface M3uPlaylist {
  channels: ParsedM3uChannel[];
  epgUrl: string | null;
}

type RawM3uChannel = {
  name?: string;
  title?: string;
  url?: string;
  logo?: string;
  group?: string | { title?: string };
  tvg?: {
    id?: string;
    logo?: string;
    language?: string;
    country?: string;
  };
};

const CATEGORY_PRIORITY = [
  "Guatemala",
  "Deportes",
  "Noticias",
  "Películas y series",
  "Documentales",
  "Infantil",
  "Música",
  "Religión",
  "Entretenimiento",
  "Español",
  "Inglés",
  "Internacional",
  "General",
];

export async function getM3uContent(): Promise<string | null> {
  const source = process.env.M3U_URL || "https://gist.githubusercontent.com/stevndrz/12132a130be81db9ed3ac94a7ef1213f/raw/ec8c09da44fd188564e57b71e21767983c6f1182/gt.m3u";

  try {
    const res = await fetch(source, { next: { revalidate: 30 } });
    if (res.ok) {
      return await res.text();
    }
  } catch (error) {
    console.error("❌ Error descargando M3U:", error);
  }

  return null;
}

// Muchas listas M3U públicas referencian su guía de programación (EPG en
// formato XMLTV) en la primera línea, ej: #EXTM3U url-tvg="https://.../epg.xml.gz"
export function getEpgUrl(m3uText: string): string | null {
  const headerLine = m3uText.split("\n", 1)[0] ?? "";
  const match = headerLine.match(/\b(?:url-tvg|x-tvg-url|tvg-url)="([^"]+)"/i);
  if (!match) return null;
  // Algunas listas separan varias URLs con coma; usamos la primera.
  const firstUrl = match[1].split(",")[0]?.trim();
  return firstUrl || null;
}

function getParser() {
  return iptvParser.parse || (iptvParser as unknown as { default?: typeof iptvParser.parse }).default || iptvParser;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Respaldo de logos para canales de Guatemala: esta lista no trae tvg-logo
// (ni tvg-id), pero sus nombres coinciden con la lista oficial de
// iptv-org/iptv, así que emparejamos por nombre normalizado contra un índice
// local (src/lib/gt-logos.json, generado desde iptv-org/database) en vez de
// depender de una descarga externa en cada request.
function normalizeForLogoMatch(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "");
}

const GT_LOGO_BY_NAME = new Map(
  (gtLogosData as { name: string; tvgId: string; logoUrl: string }[]).map((entry) => [
    normalizeForLogoMatch(entry.name),
    entry,
  ])
);

function getGroupTitle(item: RawM3uChannel) {
  if (typeof item.group === "string") return item.group;
  return item.group?.title ?? "";
}

function detectLanguageCategory(text: string) {
  const normalized = normalize(text);
  if (/\b(english|ingles|usa|united states|uk|britain|canada)\b/.test(normalized)) return "Inglés";
  if (/\b(espanol|spanish|latino|latin|mexico|colombia|argentina|chile|peru|espana)\b/.test(normalized)) return "Español";
  return "Internacional";
}

// Listas públicas grandes (ej. agregados tipo iptv-org/iptv) suelen traer
// group-title en inglés y sin tvg-id/tvg-country, así que la clasificación
// se apoya sobre todo en el nombre del canal y ese group-title.
export function normalizeM3uCategory(item: RawM3uChannel) {
  const name = item.name || item.title || "";
  const group = getGroupTitle(item);
  const country = item.tvg?.country ?? "";
  const language = item.tvg?.language ?? "";
  const text = `${name} ${group} ${country} ${language}`;
  const normalized = normalize(text);

  if (/\b(gt|guatemal\w*|chapin\w*|canal ?3|canal ?7|canal ?11|canal ?13|tn23|totovision|guatevision)\b/.test(normalized)) return "Guatemala";
  if (/\b(sport|sports|deporte|deportes|futbol|football|soccer|nba|nfl|mlb|tennis|ufc|espn|fox sports|tigo sports)\b/.test(normalized)) return "Deportes";
  if (/\b(news|noticias|noticiero|cnn|bbc|dw|tn23|teleprensa|legislative|public)\b/.test(normalized)) return "Noticias";
  if (/\b(movie|movies|cine|pelicula|peliculas|series|film|films|classic|cinemax|hbo|cinecanal)\b/.test(normalized)) return "Películas y series";
  if (/\b(documentary|documental|documentales|culture|cultura|science|ciencia|education|educativo|history|historia)\b/.test(normalized)) return "Documentales";
  if (/\b(kids|kid|infantil|ninos|niños|cartoon|disney|nick|boomerang|animation|animacion)\b/.test(normalized)) return "Infantil";
  if (/\b(music|musica|música|radio|mtv)\b/.test(normalized)) return "Música";
  if (/\b(religion|religious|religioso|iglesia|dios|peniel|bethel|rhema)\b/.test(normalized)) return "Religión";
  if (/\b(entertainment|entretenimiento|variedades|lifestyle|travel|viajes|outdoor|auto|business|comedy|comedia)\b/.test(normalized)) return "Entretenimiento";

  return detectLanguageCategory(text);
}

const ADULT_CONTENT_RE = /\b(xxx|adult|porn|erotic|erotico|hentai|playboy)\b/i;

// Limpia sufijos de calidad que muchas listas pegan al nombre del canal,
// ej. "Canal 3 (720p)" -> "Canal 3". Algunas listas apilan varios sufijos
// (ej. "Canal 3 HD 720p"), así que repite hasta que no quede nada por quitar.
function stripQualityTags(name: string): string {
  let result = name.trim();
  let previous: string;
  do {
    previous = result;
    result = result
      .replace(/[\s([-]*\b(?:fhd|uhd|4k|8k|hd|sd|h\.?26[45])\b[\s)\]-]*$/gi, "")
      .replace(/[\s([-]*\d{3,4}p[\s)\]-]*$/gi, "")
      .trim();
  } while (result !== previous && result.length > 0);
  return result || name.trim();
}

function getDeduplicationKey(item: RawM3uChannel) {
  const streamUrl = item.url?.trim();
  if (streamUrl) return `url:${streamUrl}`;

  const tvgId = item.tvg?.id?.trim();
  if (tvgId) return `tvg:${normalize(tvgId)}`;

  return `name:${normalize(item.name || item.title || "")}`;
}

export function sortM3uChannels(channels: ParsedM3uChannel[]) {
  return [...channels].sort((a, b) => {
    const categoryDelta = CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    return a.name.localeCompare(b.name, "es", { numeric: true, sensitivity: "base" });
  });
}

export function parseM3uChannels(m3uText: string): ParsedM3uChannel[] {
  const parsed = getParser()(m3uText);
  const rawChannels: RawM3uChannel[] = (parsed as { channels?: RawM3uChannel[]; items?: RawM3uChannel[] })?.channels || (parsed as { items?: RawM3uChannel[] })?.items || [];

  if (!Array.isArray(rawChannels)) return [];

  const uniqueChannels = new Map<string, RawM3uChannel>();
  rawChannels
    .filter((item) => Boolean(item?.url))
    .filter((item) => !ADULT_CONTENT_RE.test(`${item.name || item.title || ""} ${getGroupTitle(item)}`))
    .forEach((item) => {
      const key = getDeduplicationKey(item);
      if (!uniqueChannels.has(key)) uniqueChannels.set(key, item);
    });

  return sortM3uChannels(Array.from(uniqueChannels.values()).map((item, index) => {
    const name = stripQualityTags(item.name || item.title || `Canal ${index + 1}`);
    const tvgId = item.tvg?.id?.trim() ?? "";
    const logoUrl = item.tvg?.logo || item.logo || "";
    const gtLogoMatch = logoUrl ? undefined : GT_LOGO_BY_NAME.get(normalizeForLogoMatch(name));

    return {
      name,
      number: String(index + 1),
      category: normalizeM3uCategory(item),
      logoText: name.substring(0, 2).toUpperCase(),
      logoUrl: logoUrl || gtLogoMatch?.logoUrl || "",
      streamUrl: item.url ?? "",
      tvgId: tvgId || gtLogoMatch?.tvgId || "",
      isFavorite: false,
      isLive: true,
    };
  })).map((channel, index) => ({ ...channel, number: String(index + 1) }));
}

export async function loadM3uPlaylist(): Promise<M3uPlaylist> {
  const m3uText = await getM3uContent();
  if (!m3uText) return { channels: [], epgUrl: null };
  return { channels: parseM3uChannels(m3uText), epgUrl: getEpgUrl(m3uText) };
}