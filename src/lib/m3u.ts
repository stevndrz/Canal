import * as iptvParser from "iptv-playlist-parser";

export interface ParsedM3uChannel {
  name: string;
  number: string;
  category: string;
  description: string;
  logoText: string;
  logoUrl: string;
  streamUrl: string;
  color: string;
  websiteUrl: string;
  currentProgram: string;
  nextProgram: string;
  progress: number;
  isFavorite: boolean;
  isLive: boolean;
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
  const source = process.env.M3U_URL || "https://gist.githubusercontent.com/stevndrz/12132a130be81db9ed3ac94a7ef1213f/raw/864b7ab968630d1ae0e90cf4fc448cf6bc1c508d/gt.m3u";

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

function getParser() {
  return iptvParser.parse || (iptvParser as unknown as { default?: typeof iptvParser.parse }).default || iptvParser;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

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

export function normalizeM3uCategory(item: RawM3uChannel) {
  const name = item.name || item.title || "";
  const group = getGroupTitle(item);
  const country = item.tvg?.country ?? "";
  const language = item.tvg?.language ?? "";
  const text = `${name} ${group} ${country} ${language}`;
  const normalized = normalize(text);

  if (/\b(gt|guatemala|guatemalteco|chapin|canal ?3|canal ?7|tn23|totovision|rhema)\b/.test(normalized)) return "Guatemala";
  if (/\b(sport|sports|deporte|deportes|futbol|football|soccer|nba|nfl|mlb|tennis|ufc|espn|fox sports|tigo sports)\b/.test(normalized)) return "Deportes";
  if (/\b(news|noticias|noticiero|cnn|bbc|dw|tn23|teleprensa)\b/.test(normalized)) return "Noticias";
  if (/\b(movie|movies|cine|pelicula|peliculas|series|film|films)\b/.test(normalized)) return "Películas y series";
  if (/\b(kids|kid|infantil|ninos|niños|cartoon|disney|nick)\b/.test(normalized)) return "Infantil";
  if (/\b(music|musica|música|radio|mtv)\b/.test(normalized)) return "Música";
  if (/\b(religion|religious|religioso|iglesia|dios|peniel|bethel|rhema)\b/.test(normalized)) return "Religión";
  if (/\b(entertainment|entretenimiento|variedades)\b/.test(normalized)) return "Entretenimiento";

  return detectLanguageCategory(text);
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
  rawChannels.filter((item) => Boolean(item?.url)).forEach((item) => {
    const key = getDeduplicationKey(item);
    if (!uniqueChannels.has(key)) uniqueChannels.set(key, item);
  });

  return sortM3uChannels(Array.from(uniqueChannels.values()).map((item, index) => {
    const name = item.name || item.title || `Canal ${index + 1}`;
    const logoUrl = item.tvg?.logo || item.logo || "";

    return {
      name,
      number: String(index + 1),
      category: normalizeM3uCategory(item),
      description: `Señal en vivo de ${name}`,
      logoText: name.substring(0, 2).toUpperCase(),
      logoUrl,
      streamUrl: item.url ?? "",
      color: "#2dd4bf",
      websiteUrl: "",
      currentProgram: "Transmisión en vivo",
      nextProgram: "Programación regular",
      progress: 50,
      isFavorite: false,
      isLive: true,
    };
  })).map((channel, index) => ({ ...channel, number: String(index + 1) }));
}

// ⭐ ESTA ES LA FUNCIÓN QUE FALTABA Y QUE PIDE LA PÁGINA PRINCIPAL:
export async function loadM3uChannels(): Promise<ParsedM3uChannel[]> {
  const m3uText = await getM3uContent();
  return m3uText ? parseM3uChannels(m3uText) : [];
}