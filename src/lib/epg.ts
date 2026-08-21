import { gunzipSync } from "node:zlib";
import { channelNameVariants, normalizeChannelName } from "./text";

export interface EpgProgramme {
  title: string;
  start: number;
  stop: number;
}

export type EpgByChannel = Map<string, EpgProgramme[]>;

export interface EpgEntry {
  current: EpgProgramme | null;
  next: EpgProgramme | null;
}

export interface EpgGuide {
  programmesByChannel: EpgByChannel;
  // Normaliza nombre de canal -> id XMLTV. Sirve de respaldo cuando la
  // lista M3U no trae tvg-id (caso común en listas públicas grandes).
  idByName: Map<string, string>;
}

// Las guías XMLTV compartidas suelen cubrir cientos de canales de varios
// países; evitamos cargar/parsear archivos desproporcionados en una función
// serverless.
const MAX_EPG_BYTES = 15 * 1024 * 1024;
/** Tope tras descomprimir: un .gz pequeño puede expandirse a cientos de MB. */
const MAX_EPG_TEXT_BYTES = 150 * 1024 * 1024;
const MAX_PROGRAMMES = 200_000;
const MAX_CHANNELS = 50_000;

/** Cuánto se reutiliza la guía ya interpretada antes de volver a descargarla. */
const EPG_CACHE_MS = 10 * 60 * 1000;

/**
 * Tope de espera de la guía, deliberadamente corto.
 *
 * Los horarios son un adorno: la guía de canales tiene que salir aunque el
 * servidor del EPG no conteste. Muchas listas apuntan a servicios en planes
 * gratuitos que se duermen y tardan medio minuto en despertar; sin este tope,
 * esa espera se comía el tiempo de la función y la página no llegaba a
 * pintarse. Un fallo aquí se cachea igual que un acierto, así que solo la
 * primera visita paga la espera.
 */
const EPG_TIMEOUT_MS = 5000;

/**
 * Interpretar un XMLTV de miles de canales cuesta bastante y el resultado
 * cambia como mucho cada pocos minutos, así que se guarda en memoria del
 * proceso en vez de repetirlo en cada visita.
 */
let cachedEpg: { url: string; guide: EpgGuide | null; expiresAt: number } | null = null;

export async function fetchEpg(url: string): Promise<EpgGuide | null> {
  if (cachedEpg?.url === url && cachedEpg.expiresAt > Date.now()) return cachedEpg.guide;

  const guide = await downloadAndParseEpg(url);
  cachedEpg = { url, guide, expiresAt: Date.now() + EPG_CACHE_MS };
  return guide;
}

async function downloadAndParseEpg(url: string): Promise<EpgGuide | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(EPG_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`❌ La guía EPG respondió HTTP ${res.status} — ${url}`);
      return null;
    }

    const tooLarge = (bytes: number) => {
      console.error(
        `❌ Guía EPG descartada por tamaño (${Math.round(bytes / 1024 / 1024)} MB). ` +
          "Configura EPG_URL con una guía más pequeña si quieres horarios."
      );
      return null;
    };

    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength && contentLength > MAX_EPG_BYTES) return tooLarge(contentLength);

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_EPG_BYTES) return tooLarge(buffer.byteLength);

    const isGzip = buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
    const xml = isGzip
      ? gunzipSync(buffer, { maxOutputLength: MAX_EPG_TEXT_BYTES }).toString("utf-8")
      : buffer.toString("utf-8");

    return parseXmltv(xml);
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "TimeoutError"
        ? `no respondió en ${EPG_TIMEOUT_MS / 1000}s (¿servidor dormido?)`
        : String(error);
    console.error(`❌ Guía EPG descartada: ${reason} — ${url}`);
    return null;
  }
}

function getAttr(attrs: string, name: string): string | null {
  const match = attrs.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? match[1] : null;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .trim();
}

function extractTitle(inner: string): string {
  const match = inner.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  return match ? decodeXmlEntities(match[1]) : "";
}

// Formato XMLTV: YYYYMMDDHHmmss seguido de un offset opcional (+HHMM/-HHMM).
/**
 * Una marca de tiempo de XMLTV a milisegundos.
 *
 * El formato es `20260821183000 -0600`: catorce dígitos y, opcionalmente, un
 * desfase horario. Sin desfase se interpreta como UTC, que es lo que hacen los
 * lectores de XMLTV cuando la guía no lo dice.
 */
function parseXmltvTime(value: string): number | null {
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
  if (!match) return null;

  const [, y, mo, d, h, mi, s, tz] = match;
  const enUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return enUtc - desfaseEnMs(tz);
}

/** `-0600` → -21.600.000 ms. Sin desfase, cero. */
function desfaseEnMs(tz: string | undefined): number {
  if (!tz) return 0;
  const signo = tz[0] === "-" ? -1 : 1;
  const minutos = Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5));
  return signo * minutos * 60_000;
}

/**
 * Interpreta una guía XMLTV.
 *
 * Se apoya en dos pasadas separadas porque son dos trabajos distintos:
 * la primera construye el índice de **nombre → id** y la segunda la lista de
 * programas por canal. Estaban juntas en una sola función con dos bucles
 * anidados —lo que CodeScene llama *Bumpy Road*— y para entender cualquiera de
 * las dos había que leer las dos.
 *
 * Con expresiones regulares y no con un analizador de XML a propósito: estas
 * guías pesan decenas de megabytes y montar un DOM entero para sacar cuatro
 * atributos por nodo costaría más memoria de la que tiene un televisor.
 */
export function parseXmltv(xml: string): EpgGuide {
  return {
    idByName: indexarCanales(xml),
    programmesByChannel: indexarProgramas(xml),
  };
}

/**
 * Nombre normalizado → id de canal.
 *
 * Hace falta porque la mayoría de listas M3U públicas no traen `tvg-id`, así
 * que la única forma de emparejar un canal con su guía es por el nombre.
 * **Gana el primero**: una guía puede declarar varios `display-name` para el
 * mismo canal, y el primero es el principal.
 */
function indexarCanales(xml: string): Map<string, string> {
  const idPorNombre = new Map<string, string>();
  const canalRe = /<channel([^>]*)>([\s\S]*?)<\/channel>/g;
  let canal: RegExpExecArray | null;
  let vistos = 0;

  while (vistos < MAX_CHANNELS && (canal = canalRe.exec(xml))) {
    vistos++;
    const [, atributos, interior] = canal;
    const id = getAttr(atributos, "id")?.trim();
    if (!id) continue;

    const nombreRe = /<display-name[^>]*>([\s\S]*?)<\/display-name>/g;
    let nombre: RegExpExecArray | null;
    while ((nombre = nombreRe.exec(interior))) {
      const clave = normalizeChannelName(decodeXmlEntities(nombre[1]));
      if (clave && !idPorNombre.has(clave)) idPorNombre.set(clave, id);
    }
  }

  return idPorNombre;
}

/** Id de canal → sus programas, descartando los que estén incompletos. */
function indexarProgramas(xml: string): EpgByChannel {
  const porCanal: EpgByChannel = new Map();
  const programaRe = /<programme([^>]*)>([\s\S]*?)<\/programme>/g;
  let programa: RegExpExecArray | null;
  let vistos = 0;

  while (vistos < MAX_PROGRAMMES && (programa = programaRe.exec(xml))) {
    vistos++;
    const entrada = leerPrograma(programa[1], programa[2]);
    if (!entrada) continue;

    const lista = porCanal.get(entrada.canalId);
    if (lista) lista.push(entrada.programa);
    else porCanal.set(entrada.canalId, [entrada.programa]);
  }

  return porCanal;
}

/**
 * Un `<programme>`, o `null` si le falta algo imprescindible.
 *
 * Sin canal, sin horas o sin título no se puede pintar nada: se descarta en
 * vez de guardar una entrada a medias que luego habría que comprobar en cada
 * sitio donde se lee.
 */
function leerPrograma(
  atributos: string,
  interior: string
): { canalId: string; programa: EpgProgramme } | null {
  const canalId = getAttr(atributos, "channel")?.trim().toLowerCase();
  const start = parseXmltvTime(getAttr(atributos, "start") ?? "");
  const stop = parseXmltvTime(getAttr(atributos, "stop") ?? "");
  const title = extractTitle(interior);

  if (!canalId || start == null || stop == null || !title) return null;
  return { canalId, programa: { title, start, stop } };
}

function findProgrammes(guide: EpgGuide, tvgId: string, channelName: string): EpgProgramme[] | null {
  const byId = tvgId.trim().toLowerCase();
  if (byId) {
    const direct = guide.programmesByChannel.get(byId);
    if (direct) return direct;

    // Las listas estilo iptv-org marcan la señal en el id (`Canal3.gt@SD`)
    // mientras que la guía suele publicarlo sin ese sufijo.
    const withoutFeed = byId.split("@")[0];
    if (withoutFeed !== byId) {
      const base = guide.programmesByChannel.get(withoutFeed);
      if (base) return base;
    }
  }

  // Respaldo por nombre: la mayoría de listas públicas no traen tvg-id.
  for (const variant of channelNameVariants(channelName)) {
    const resolvedId = guide.idByName.get(normalizeChannelName(variant));
    const programmes = resolvedId ? guide.programmesByChannel.get(resolvedId.toLowerCase()) : undefined;
    if (programmes) return programmes;
  }

  return null;
}

export function getEpgEntry(guide: EpgGuide, tvgId: string, channelName: string, now: number): EpgEntry | null {
  const programmes = findProgrammes(guide, tvgId, channelName);
  if (!programmes || programmes.length === 0) return null;

  let current: EpgProgramme | null = null;
  let next: EpgProgramme | null = null;
  for (const programme of programmes) {
    if (programme.start <= now && now < programme.stop) current = programme;
    if (programme.start > now && (!next || programme.start < next.start)) next = programme;
  }
  return current || next ? { current, next } : null;
}
