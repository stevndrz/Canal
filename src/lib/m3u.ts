import * as iptvParser from "iptv-playlist-parser";
import { classifyChannel, compareByCategory, priorityRank } from "./categories";
import { normalizeText } from "./text";
import { findLogoUrl } from "./logos";
import type { Channel } from "./types";
import { serverConfig } from "@/lib/config.server";
import { paraRegistro } from "./url-segura";

/**
 * Lo que produce el parseo de la lista M3U: todavía sin `id` (lo asigna
 * `page.tsx` al numerar) ni datos de EPG (se cruzan aparte, porque la guía es
 * una fuente independiente que puede fallar sin tumbar la lista de canales).
 */
/**
 * Un canal recién interpretado, antes de empaquetarlo. Sin `id` —es la
 * posición— y **sin `number`**: se rellenaba aquí y el cliente lo sobrescribía
 * al llegar, o sea 30 KB que se bajaban, se interpretaban y se tiraban. Ahora
 * lo pone `desempaquetarCanales` en su misma pasada.
 */
export type ParsedChannel = Omit<Channel, "id" | "number">;

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
 * Los únicos esquemas que llegan a reproducirse, y por tanto los únicos que se
 * dejan pasar.
 *
 * Esta lista la escribe quien controle el M3U, no quien despliega, y su `url`
 * acaba en `hls.loadSource()`, en `video.src` y en lo que se manda al
 * Chromecast. Todos los demás sitios de la app que reciben una URL de fuera ya
 * comprueban el esquema —`stremio.ts`, `buildEmbedUrl`, `urlUtilizable`— y este
 * era el único que no: entraba tal cual.
 *
 * No cambia lo que se ve. `rtmp:`, `rtsp:` y compañía no los reproduce ningún
 * navegador, así que las entradas que se descartan son las que habrían dado
 * pantalla negra. Lo que se evita es que un `javascript:` o un `data:` de una
 * lista ajena viaje hasta el cliente esperando encontrar un hueco donde sí
 * cuente.
 */
const ESQUEMA_REPRODUCIBLE = /^https?:\/\//i;

/**
 * Tope de espera al descargar la lista. Sin él, un origen que no responde deja
 * la petición colgada hasta que la plataforma corta la función entera y la
 * página no llega a pintarse.
 */
const M3U_TIMEOUT_MS = 8000;

/** Cuánto se reutiliza la lista ya interpretada antes de volver a descargarla. */
const PLAYLIST_CACHE_MS = 5 * 60 * 1000;

/**
 * Tope de tamaño de la lista. El tiempo de espera solo no protege: un origen
 * rápido con un cuerpo enorme agota la memoria antes de que el reloj sirva de
 * nada, y `response.text()` no tiene freno. 20 MB deja margen de sobra — la
 * lista por defecto son 1,6 MB.
 */
const MAX_M3U_BYTES = 20 * 1024 * 1024;

export function getM3uSourceUrl(): string {
  return serverConfig().m3uUrl;
}

async function fetchM3uText(): Promise<string | null> {
  const source = getM3uSourceUrl();
  try {
    // `no-store` a propósito: la caché de datos de Next descarta respuestas de
    // más de 2 MB, y estas listas las superan de largo. El almacenamiento lo
    // hace loadM3uPlaylist(), que además evita volver a descargar.
    const response = await fetch(source, {
      cache: "no-store",
      signal: AbortSignal.timeout(M3U_TIMEOUT_MS),
    });
    if (response.ok) {
      const declarado = Number(response.headers.get("content-length") || 0);
      if (declarado && declarado > MAX_M3U_BYTES) {
        console.error(
          `❌ Lista M3U descartada por tamaño (${Math.round(declarado / 1024 / 1024)} MB) — ${paraRegistro(source)}`
        );
        return null;
      }
      // Y otra vez con el cuerpo ya leído: `content-length` puede faltar o
      // mentir, así que la comprobación de verdad es esta.
      const texto = await response.text();
      if (texto.length > MAX_M3U_BYTES) {
        console.error(
          `❌ Lista M3U descartada por tamaño (${Math.round(texto.length / 1024 / 1024)} MB) — ${paraRegistro(source)}`
        );
        return null;
      }
      return texto;
    }
    console.error(`❌ La lista M3U respondió HTTP ${response.status} — ${paraRegistro(source)}`);
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? `no respondió en ${M3U_TIMEOUT_MS / 1000}s`
        : String(error);
    console.error(`❌ Error descargando la lista M3U (${reason}) — ${paraRegistro(source)}`);
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
 * Restos de atributos que se cuelan en el nombre cuando quien generó la lista
 * partió mal la línea `#EXTINF`. El gist trae entradas cuyo nombre es
 * literalmente un trozo de user-agent: `like Gecko) Chrome/120.0 ...",SIL TV`.
 */
const SPILLED_ATTRIBUTES = /gecko\)|chrome\/|libvlc|group-title|user-agent|safari\//i;

/**
 * Rescata el nombre real de una entrada mal formada.
 *
 * En `#EXTINF` el nombre es lo que va tras la última coma, así que cuando se
 * detecta basura de atributos se toma ese trozo. Se hace solo en ese caso: hay
 * canales con coma legítima en el nombre y partirlos siempre los estropearía.
 */
function rescueSpilledName(rawName: string): string {
  if (!SPILLED_ATTRIBUTES.test(rawName)) return rawName;
  const afterLastComma = rawName.slice(rawName.lastIndexOf(",") + 1).trim();
  return afterLastComma || rawName;
}

/**
 * Quita sufijos de calidad y notas del nombre, ej.
 * `BBC Persian (720p) (HEVC) [Not 24/7]` -> `BBC Persian`. Se repite porque
 * suelen venir apilados.
 */
export function cleanChannelName(rawName: string): string {
  let result = rescueSpilledName(rawName).trim();
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
function countryFromTvgId(tvgId: string): string {
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
  // Se calcula el rango una sola vez por canal: hacerlo dentro del comparador
  // significaría recorrer las expresiones regulares en cada comparación, y con
  // listas de miles de canales eso son cientos de miles de evaluaciones.
  const rank = new Map(channels.map((channel) => [channel, priorityRank(channel.name, channel.category)]));

  return [...channels].sort((a, b) => {
    const byCategory = compareByCategory(a.category, b.category);
    if (byCategory !== 0) return byCategory;

    // Dentro de la categoría mandan los canales importantes, en su orden. El
    // número de canal no interviene: en una lista con miles de señales de
    // varios países no dice nada de lo que alguien quiere ver.
    const byPriority = (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
    if (byPriority !== 0) return byPriority;

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
    if (!item?.url || !ESQUEMA_REPRODUCIBLE.test(item.url.trim())) continue;
    if (ADULT_CONTENT.test(`${item.name || item.title || ""} ${getGroupTitle(item)}`)) continue;
    const key = getDeduplicationKey(item);
    if (!unique.has(key)) unique.set(key, item);
  }

  const channels = Array.from(unique.values()).map<ParsedChannel>((item, index) => {
    const name = cleanChannelName(item.name || item.title || item.tvg?.name || `Canal ${index + 1}`);
    const group = getGroupTitle(item);
    const tvgId = item.tvg?.id?.trim() ?? "";
    // El logo de la lista manda; si no trae, se busca por nombre en el índice local.
    // El logo sale de la lista y acaba en un `<img src>`: mismo criterio. Sin
    // esquema válido se cae al índice local, que es el camino que ya existía
    // para las entradas sin logo.
    const deLaLista = item.tvg?.logo || item.logo || "";
    const logoUrl =
      (ESQUEMA_REPRODUCIBLE.test(deLaLista.trim()) ? deLaLista : "") || findLogoUrl(name) || "";

    return {
      name,
      category: classifyChannel({
        name,
        group,
        country: item.tvg?.country || countryFromTvgId(tvgId),
        language: item.tvg?.language ?? "",
      }),
      logoUrl,
      streamUrl: item.url ?? "",
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
