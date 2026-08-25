#!/usr/bin/env node
/**
 * Indexador de listas iptv-org → playlist curada en español.
 *
 * Pipeline:
 *   1. Descarga la lista del idioma español + las de países LATAM de iptv-org.
 *   2. Fusiona y deduplica (por URL, y por nombre normalizado).
 *   3. VERIFICA cada stream en vivo (GET con timeout): los muertos,
 *      geo-bloqueados o que no responden se descartan.
 *   4. Escribe una lista M3U limpia, agrupada por país, lista para
 *      apuntar `M3U_URL` de CanalCasa.
 *
 * Uso:
 *   node scripts/build-spanish-playlist.mjs [--limit N] [--timeout MS]
 *        [--out RUTA] [--no-check] [--concurrency N]
 *
 * Sin dependencias: solo Node >= 20 (fetch global).
 */

import { writeFile } from "node:fs/promises";

const IPTV_ORG = "https://iptv-org.github.io/iptv";
/** Idioma español completo + países LATAM (trae señales que spa.m3u etiqueta mal). */
const SOURCES = [
  { label: "spa", url: `${IPTV_ORG}/languages/spa.m3u`, kind: "language" },
  ...["gt", "mx", "co", "ar", "cl", "pe", "ve", "ec", "uy", "py", "bo", "cr", "pa", "hn", "sv", "ni", "do"].map(
    (c) => ({ label: c, url: `${IPTV_ORG}/countries/${c}.m3u`, kind: "country" })
  ),
];

const ADULT_CONTENT = /\b(xxx|adult|porn|erotic|erotico|hentai|playboy)\b/i;

/* ── CLI ─────────────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const LIMIT = Number(flag("limit", 0)) || Infinity;
const TIMEOUT_MS = Number(flag("timeout", 6000));
const CONCURRENCY = Number(flag("concurrency", 16));
const OUT = String(flag("out", "playlists/es-latam.m3u"));
const CHECK = !args.includes("--no-check");

/* ── Descarga y parseo ───────────────────────────────────────────────── */
async function fetchSource({ label, url }) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "CanalCasa-playlist-builder/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { label, text: await res.text() };
  } catch (error) {
    console.warn(`⚠️  ${label}: ${error.message} — se omite la fuente`);
    return { label, text: "" };
  }
}

function parseM3u(text) {
  const channels = [];
  const lines = text.split(/\r?\n/);
  let pending = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const attrs = {};
      for (const [, key, value] of line.matchAll(/([a-zA-Z0-9-]+)="([^"]*)"/g)) {
        attrs[key.toLowerCase()] = value;
      }
      const nameMatch = line.match(/#EXTINF:-?\d+[^\n]*?,(.*)$/);
      pending = {
        name: (nameMatch?.[1] ?? "").trim(),
        tvgId: attrs["tvg-id"] ?? "",
        logo: attrs["tvg-logo"] ?? "",
        group: attrs["group-title"] ?? "",
      };
      continue;
    }
    if (!line.startsWith("#") && pending) {
      channels.push({ ...pending, url: line });
      pending = null;
    }
  }
  return channels;
}

/* ── Deduplicación ───────────────────────────────────────────────────── */
function normalizeName(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\b(hd|fhd|uhd|4k|8k|sd)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

function dedupe(channels) {
  const byUrl = new Map();
  const byName = new Map();
  for (const ch of channels) {
    if (ADULT_CONTENT.test(`${ch.name} ${ch.group}`)) continue;
    if (byUrl.has(ch.url)) continue;
    byUrl.set(ch.url, ch);
    const key = normalizeName(ch.name);
    if (key && !byName.has(key)) byName.set(key, ch); // primer representante
  }
  // De los duplicados por nombre deja solo el primero (misma señal, URLs espejo).
  return [...byUrl.values()].filter((ch) => byName.get(normalizeName(ch.name)) === ch);
}

/* ── Verificación de streams ─────────────────────────────────────────── */
async function checkStream(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "User-Agent": "VLC/3.0.20 LibVLC/3.0.20", Accept: "*/*" },
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const ctype = res.headers.get("content-type") ?? "";
    if (/mpegurl|video|mp2t|octet-stream/i.test(ctype)) return { ok: true };
    // Algunos servidores sirven texto plano: olfatea el manifiesto.
    const reader = res.body?.getReader();
    if (!reader) return { ok: true };
    const { value } = await reader.read();
    await reader.cancel().catch(() => {});
    const head = new TextDecoder().decode(value ?? new Uint8Array());
    return head.includes("#EXTM3U")
      ? { ok: true }
      : { ok: false, reason: `content-type inesperado (${ctype || "vacío"})` };
  } catch (error) {
    return { ok: false, reason: error.name === "TimeoutError" ? "timeout" : error.message.slice(0, 60) };
  }
}

async function pool(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  async function lane() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
      if (i % 200 === 0 && i > 0) console.log(`   … ${i}/${items.length} verificados`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return results;
}

/* ── Salida ──────────────────────────────────────────────────────────── */
function countryOf(ch, fallbackLabel) {
  const match = ch.tvgId.match(/\.([a-z]{2})(?:@|$)/i);
  return (match?.[1] ?? "").toUpperCase() || fallbackLabel.toUpperCase();
}

function renderM3u(channels) {
  const lines = [
    `#EXTM3U url-tvg="https://iptv-org.github.io/epg/index.xml" x-tvg-url="https://iptv-org.github.io"`,
    `# Generada por scripts/build-spanish-playlist.mjs — ${new Date().toISOString()}`,
    `# Canales verificados vivos en el momento de la generación.`,
  ];
  const sorted = [...channels].sort((a, b) =>
    a._country.localeCompare(b._country) || a.name.localeCompare(b.name, "es")
  );
  for (const ch of sorted) {
    lines.push(
      `#EXTINF:-1 tvg-id="${ch.tvgId}" tvg-logo="${ch.logo}" group-title="${ch._country} · ${ch.group}",${ch.name}`
    );
    lines.push(ch.url);
  }
  return lines.join("\n") + "\n";
}

/* ── Main ────────────────────────────────────────────────────────────── */
console.log(`📥 Descargando ${SOURCES.length} fuentes de iptv-org…`);
const sources = await Promise.all(SOURCES.map(fetchSource));

let merged = [];
for (const { label, text } of sources) {
  const parsed = parseM3u(text).slice(0, Math.max(0, LIMIT === Infinity ? Infinity : Math.ceil(LIMIT / sources.length)));
  merged.push(...parsed.map((ch) => ({ ...ch, _src: label })));
}
console.log(`📋 Entradas brutas: ${merged.length}`);

const unique = dedupe(merged).slice(0, LIMIT);
console.log(`🔁 Tras deduplicación y filtro adulto: ${unique.length}`);

if (!CHECK) {
  const out = unique.map((ch) => ({ ...ch, _country: countryOf(ch, ch._src) }));
  await writeFile(OUT, renderM3u(out));
  console.log(`✅ ${out.length} canales escritos en ${OUT} (SIN verificar)`);
  process.exit(0);
}

console.log(`🩺 Verificando ${unique.length} streams (${CONCURRENCY} en paralelo, timeout ${TIMEOUT_MS}ms)…`);
const checks = await pool(unique, async (ch) => ({ ch, ...(await checkStream(ch.url)) }));

const alive = [];
const reasons = new Map();
for (const { ch, ok, reason } of checks) {
  if (ok) alive.push(ch);
  else reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
}
for (const ch of alive) ch._country = countryOf(ch, ch._src);

await writeFile(OUT, renderM3u(alive));
console.log(`\n✅ Vivos: ${alive.length}  →  ${OUT}`);
console.log(`☠️  Descartados por motivo:`);
for (const [reason, count] of [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`   ${String(count).padStart(5)}  ${reason}`);
}
