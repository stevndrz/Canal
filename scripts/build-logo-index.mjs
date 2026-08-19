#!/usr/bin/env node
/**
 * Genera src/lib/logo-index.json: un índice de "nombre de canal normalizado" ->
 * "URL de logo", construido desde la base de datos pública de iptv-org.
 *
 * Ninguna lista M3U garantiza traer tvg-logo, así que este índice permite
 * mostrar logos para cualquier lista, emparejando por nombre. Los canales sin
 * coincidencia caen al monograma de color de su categoría.
 *
 * Uso:
 *   node scripts/build-logo-index.mjs                 # descarga los CSV
 *   node scripts/build-logo-index.mjs ./ruta/a/data   # usa CSV locales
 *
 * Regenerar cuando se quieran logos de canales nuevos.
 */
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://raw.githubusercontent.com/iptv-org/database/master/data";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "logo-index.json");

// Prefijos/sufijos frecuentes: se sustituyen por un código de un carácter para
// que el índice ocupe ~40% menos. src/lib/logos.ts revierte la sustitución.
const PREFIXES = [
  "https://i.imgur.com/",
  "https://upload.wikimedia.org/wikipedia/commons/",
  "https://images.pluto.tv/",
  "https://i.ibb.co/",
  "https://static.wikia.nocookie.net/",
  "https://dtil.tmsimg.com/",
  "https://jiotvimages.cdn.jio.com/",
  "https://xstreamcp-assets-msp.streamready.in/",
  "https://",
  "http://",
];
const SUFFIXES = [".png", ".jpg", ".jpeg", ".svg"];
const ALPHA = "0123456789abcdefghijklmnopqrstuvwxyz";

function encodeUrl(url) {
  let p = PREFIXES.length;
  let s = SUFFIXES.length;
  for (let i = 0; i < PREFIXES.length; i++) {
    if (url.startsWith(PREFIXES[i])) {
      p = i;
      url = url.slice(PREFIXES[i].length);
      break;
    }
  }
  for (let i = 0; i < SUFFIXES.length; i++) {
    if (url.endsWith(SUFFIXES[i])) {
      s = i;
      url = url.slice(0, -SUFFIXES[i].length);
      break;
    }
  }
  return ALPHA[p] + ALPHA[s] + url;
}

// Debe mantenerse alineado con normalizeChannelName() de src/lib/logos.ts.
function normalizeChannelName(value) {
  return Array.from(
    value
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/\b(hd|fhd|uhd|4k|sd)\b/g, " ")
  )
    .filter((c) => /\p{L}|\p{N}/u.test(c))
    .join("");
}

function nameVariants(name) {
  const variants = [name];
  const withoutParens = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (withoutParens && withoutParens !== name) variants.push(withoutParens);
  return variants;
}

/** Parser CSV mínimo con soporte de comillas (los datos traen comas dentro de campos). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

async function loadCsv(name, localDir) {
  if (localDir) {
    const path = join(localDir, name);
    if (existsSync(path)) return parseCsv(readFileSync(path, "utf-8"));
  }
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`No se pudo descargar ${name}: HTTP ${res.status}`);
  return parseCsv(await res.text());
}

const localDir = process.argv[2];
const [logoRows, channelRows] = await Promise.all([
  loadCsv("logos.csv", localDir),
  loadCsv("channels.csv", localDir),
]);

// Un logo por canal, prefiriendo el marcado como in_use.
const logoByChannel = new Map();
for (const row of logoRows) {
  if (!row.channel || !row.url) continue;
  const inUse = row.in_use === "TRUE";
  const previous = logoByChannel.get(row.channel);
  if (!previous || (inUse && !previous.inUse)) logoByChannel.set(row.channel, { url: row.url, inUse });
}

const index = {};
for (const row of channelRows) {
  const logo = logoByChannel.get(row.id);
  if (!logo) continue;
  const encoded = encodeUrl(logo.url);
  const names = [row.name, ...(row.alt_names || "").split(";")];
  for (const name of names) {
    if (!name?.trim()) continue;
    for (const variant of nameVariants(name.trim())) {
      const key = normalizeChannelName(variant);
      if (key.length >= 3 && !(key in index)) index[key] = encoded;
    }
  }
}

const payload = { prefixes: PREFIXES, suffixes: SUFFIXES, logos: index };
writeFileSync(OUT, JSON.stringify(payload));
console.log(`✅ ${Object.keys(index).length} nombres indexados -> ${OUT}`);
