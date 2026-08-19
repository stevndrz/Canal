import { gunzipSync } from "node:zlib";

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

// Las guías XMLTV compartidas suelen cubrir cientos de canales de varios
// países; evitamos cargar/parsear archivos desproporcionados en una función
// serverless.
const MAX_EPG_BYTES = 15 * 1024 * 1024;
const MAX_PROGRAMMES = 200_000;

export async function fetchEpg(url: string): Promise<EpgByChannel | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;

    const contentLength = Number(res.headers.get("content-length") || 0);
    if (contentLength && contentLength > MAX_EPG_BYTES) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > MAX_EPG_BYTES) return null;

    const isGzip = buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;
    const xml = isGzip ? gunzipSync(buffer).toString("utf-8") : buffer.toString("utf-8");

    return parseXmltv(xml);
  } catch (error) {
    console.error("❌ Error descargando/leyendo EPG:", error);
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
function parseXmltvTime(value: string): number | null {
  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, tz] = match;
  const asUtcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  if (!tz) return asUtcMs;
  const sign = tz[0] === "-" ? -1 : 1;
  const offsetMinutes = sign * (Number(tz.slice(1, 3)) * 60 + Number(tz.slice(3, 5)));
  return asUtcMs - offsetMinutes * 60_000;
}

export function parseXmltv(xml: string): EpgByChannel {
  const byChannel: EpgByChannel = new Map();
  const programmeRe = /<programme([^>]*)>([\s\S]*?)<\/programme>/g;

  let match: RegExpExecArray | null;
  let count = 0;
  while (count < MAX_PROGRAMMES && (match = programmeRe.exec(xml))) {
    count++;
    const [, attrs, inner] = match;
    const channelId = getAttr(attrs, "channel")?.trim().toLowerCase();
    const start = parseXmltvTime(getAttr(attrs, "start") ?? "");
    const stop = parseXmltvTime(getAttr(attrs, "stop") ?? "");
    const title = extractTitle(inner);
    if (!channelId || start == null || stop == null || !title) continue;

    const list = byChannel.get(channelId);
    if (list) list.push({ title, start, stop });
    else byChannel.set(channelId, [{ title, start, stop }]);
  }

  return byChannel;
}

export function getEpgEntry(byChannel: EpgByChannel, tvgId: string, now: number): EpgEntry | null {
  const key = tvgId.trim().toLowerCase();
  if (!key) return null;
  const programmes = byChannel.get(key);
  if (!programmes || programmes.length === 0) return null;

  let current: EpgProgramme | null = null;
  let next: EpgProgramme | null = null;
  for (const programme of programmes) {
    if (programme.start <= now && now < programme.stop) current = programme;
    if (programme.start > now && (!next || programme.start < next.start)) next = programme;
  }
  return current || next ? { current, next } : null;
}
