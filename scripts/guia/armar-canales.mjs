#!/usr/bin/env node
/**
 * Arma la lista de canales que baja la guía diaria (`.github/workflows/guia.yml`).
 *
 *   node scripts/guia/armar-canales.mjs --epg <clon de iptv-org/epg> --salida canales.channels.xml
 *
 * Cruza la lista M3U de la casa con los canales que ya sabe leer iptv-org/epg
 * (`sites/<sitio>/*.channels.xml`). Va solo: si la lista gana un canal y algún
 * sitio tiene su guía, entra al día siguiente sin tocar nada.
 *
 * Reglas:
 * - Se empareja por `tvg-id` (sin la parte `@SD`): iptv-org/epg usa los
 *   mismos ids que la lista, que viene de iptv-org.
 * - Solo lo que se ve en casa: en español, o de Guatemala, Centroamérica y
 *   México. La lista tiene 4.900 canales y bajar la guía de todos cada día
 *   sería lento para la tarea y pesado para la app.
 * - Un sitio por canal, por orden de `PREFERENCIA`. En la salida va el
 *   `tvg-id` exacto de la lista: así la app lo encuentra sin adivinar.
 * - `MANUALES` manda: canales cuyo id en el sitio no coincide con el nuestro.
 *
 * Por rondas: un sitio puede no traer nada ese día (los de Plex de i.mjh.nz
 * vienen vacíos a menudo). Con `--intentos` y `--guias`, la siguiente ronda
 * da a cada canal que quedó vacío su siguiente sitio, sin repetir.
 *
 * Sin dependencias: corre con el Node del runner antes de instalar nada.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Países «de aquí»: entran aunque el canal no sea en español. */
export const PAISES_DE_AQUI = new Set(["gt", "sv", "hn", "ni", "cr", "pa", "bz", "mx"]);

/**
 * Qué sitio se usa cuando hay varios. mi.tv primero: sus horas cuadran con lo
 * que se ve (comprobado con open-epg, 2026-11-12). Luego los que salen de una
 * API (Pluto, Samsung, Plex: i.mjh.nz), que no se rompen cuando cambia un
 * diseño. GatoTV va por nuestro envoltorio, que le arregla la hora.
 */
export const PREFERENCIA = ["mi.tv", "pluto.tv", "plex.tv", "i.mjh.nz", "gatotv.com", "programacion-tv.elpais.com"];

/** El lector de GatoTV de iptv-org lee las horas como de Nueva York. Ver `gatotv.com.canalcasa.config.js`. */
export const SITIO_CORREGIDO = { "gatotv.com": "gatotv.com.canalcasa" };

/**
 * Los que no se emparejan solos: en el sitio no tienen id, o tienen otro
 * («Televisiete.gt» frente a nuestro «Canal7.gt»).
 */
export const MANUALES = [
  { tvgId: "Canal3.gt@SD", site: "mi.tv", siteId: "gt#canal-3", nombre: "Canal 3" },
  { tvgId: "Canal7.gt@SD", site: "mi.tv", siteId: "gt#televisiete", nombre: "Canal 7" },
  { tvgId: "TN23.gt@SD", site: "gatotv.com", siteId: "tn23", nombre: "TN23" },
];

/** Tope de canales: lo que la tarea baja en unos minutos y la app lee sin esfuerzo. */
export const MAXIMO = 250;

const base = (id) => id.trim().toLowerCase().split("@")[0];
const paisDe = (id) => base(id).split(".").pop() ?? "";

function decodificar(texto) {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapar(texto) {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Los `tvg-id` de la lista, indexados por su base: `canal7.gt` → `Canal7.gt@SD`. */
export function idsDeLaLista(m3u) {
  const ids = new Map();
  for (const [, id] of m3u.matchAll(/tvg-id="([^"]+)"/g)) {
    const clave = base(id);
    if (clave && !ids.has(clave)) ids.set(clave, id);
  }
  return ids;
}

/** Los canales de un `*.channels.xml` de iptv-org/epg. */
export function leerCanalesDeSitio(xml) {
  const canales = [];
  for (const [, atributos, nombre] of xml.matchAll(/<channel\s([^>]*)>([^<]*)<\/channel>/g)) {
    const valor = (clave) => decodificar(atributos.match(new RegExp(`\\b${clave}="([^"]*)"`))?.[1] ?? "");
    canales.push({ site: valor("site"), siteId: valor("site_id"), lang: valor("lang"), xmltvId: valor("xmltv_id"), nombre: decodificar(nombre).trim() });
  }
  return canales;
}

/**
 * La lista final: un sitio por canal de la lista, con el `tvg-id` de la lista.
 *
 * @param {Map<string, string>} ids — `idsDeLaLista`
 * @param {{ site: string, siteId: string, lang: string, xmltvId: string, nombre: string }[]} disponibles
 * @param intentados — rondas siguientes: `base → sitios ya probados`. Solo
 *   entran los canales de ahí que no están en `conProgramas`, con un sitio
 *   que no se haya probado, de cualquier idioma (el canal ya pasó el filtro).
 */
export function elegirCanales(
  ids,
  disponibles,
  { manuales = MANUALES, maximo = MAXIMO, intentados = null, conProgramas = new Set() } = {},
) {
  const rango = (site) => {
    const i = PREFERENCIA.indexOf(site);
    return i === -1 ? PREFERENCIA.length : i;
  };
  const elegidos = new Map();
  const ronda = intentados !== null;
  const pendiente = (clave, site) =>
    !ronda || (intentados.has(clave) && !conProgramas.has(clave) && !intentados.get(clave).has(SITIO_CORREGIDO[site] ?? site));

  for (const m of ronda ? [] : manuales) {
    const clave = base(m.tvgId);
    if (ids.has(clave)) elegidos.set(clave, { site: m.site, siteId: m.siteId, lang: "es", tvgId: ids.get(clave), nombre: m.nombre });
  }

  const candidatos = disponibles
    .filter((c) => c.xmltvId && c.siteId && ids.has(base(c.xmltvId)))
    .filter((c) => ronda || c.lang === "es" || PAISES_DE_AQUI.has(paisDe(c.xmltvId)))
    .filter((c) => pendiente(base(c.xmltvId), c.site))
    .sort((a, b) => rango(a.site) - rango(b.site) || a.site.localeCompare(b.site));

  for (const c of candidatos) {
    const clave = base(c.xmltvId);
    if (elegidos.has(clave)) continue;
    elegidos.set(clave, { site: c.site, siteId: c.siteId, lang: c.lang || "es", tvgId: ids.get(clave), nombre: c.nombre });
  }

  // Lo de aquí primero, por si el tope corta: Guatemala, la región, el resto.
  const orden = (c) => (paisDe(c.tvgId) === "gt" ? 0 : PAISES_DE_AQUI.has(paisDe(c.tvgId)) ? 1 : 2);
  return [...elegidos.values()]
    .sort((a, b) => orden(a) - orden(b) || a.tvgId.localeCompare(b.tvgId))
    .slice(0, maximo)
    .map((c) => ({ ...c, site: SITIO_CORREGIDO[c.site] ?? c.site }));
}

export function aXml(canales) {
  const filas = canales.map(
    (c) =>
      `  <channel site="${escapar(c.site)}" site_id="${escapar(c.siteId)}" lang="${escapar(c.lang)}" xmltv_id="${escapar(c.tvgId)}">${escapar(c.nombre)}</channel>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<channels>\n${filas.join("\n")}\n</channels>\n`;
}

/** Todos los `*.channels.xml` de un clon de iptv-org/epg. */
function leerSitios(raizEpg) {
  const sitios = join(raizEpg, "sites");
  const canales = [];
  for (const sitio of readdirSync(sitios)) {
    let archivos = [];
    try {
      archivos = readdirSync(join(sitios, sitio)).filter((n) => n.endsWith(".channels.xml"));
    } catch {
      continue;
    }
    for (const archivo of archivos) canales.push(...leerCanalesDeSitio(readFileSync(join(sitios, sitio, archivo), "utf8")));
  }
  return canales;
}

/** Los canales (por base) que tienen al menos un programa en una guía XMLTV. */
export function canalesConProgramas(xml) {
  return new Set([...xml.matchAll(/<programme\b[^>]*\bchannel="([^"]+)"/g)].map(([, id]) => base(decodificar(id))));
}

function leerIntentos(ruta) {
  try {
    return new Map(Object.entries(JSON.parse(readFileSync(ruta, "utf8"))).map(([k, v]) => [k, new Set(v)]));
  } catch {
    return new Map();
  }
}

function guardarIntentos(ruta, intentados, canales) {
  for (const c of canales) {
    const clave = base(c.tvgId);
    if (!intentados.has(clave)) intentados.set(clave, new Set());
    intentados.get(clave).add(c.site);
  }
  writeFileSync(ruta, JSON.stringify(Object.fromEntries([...intentados].map(([k, v]) => [k, [...v]]))));
}

const LISTA_POR_DEFECTO = "https://gist.githubusercontent.com/stevndrz/8249817782d5a3c659f963f565916243/raw/gistfile1.txt";

async function principal() {
  const argumento = (nombre) => {
    const i = process.argv.indexOf(nombre);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const raizEpg = argumento("--epg");
  const salida = argumento("--salida") ?? "canales.channels.xml";
  if (!raizEpg) throw new Error("Falta --epg <carpeta del clon de iptv-org/epg>");

  const origen = argumento("--lista") ?? process.env.LISTA_URL ?? LISTA_POR_DEFECTO;
  const m3u = /^https?:/.test(origen)
    ? await fetch(origen, { signal: AbortSignal.timeout(30_000) }).then((r) => {
        if (!r.ok) throw new Error(`La lista respondió HTTP ${r.status}`);
        return r.text();
      })
    : readFileSync(origen, "utf8");

  const ids = idsDeLaLista(m3u);
  if (ids.size < 100) throw new Error(`La lista solo trae ${ids.size} tvg-id: ¿es la buena?`);

  const rutaIntentos = argumento("--intentos");
  const guias = (argumento("--guias") ?? "").split(",").filter(Boolean);
  const intentados = guias.length && rutaIntentos ? leerIntentos(rutaIntentos) : null;
  const conProgramas = new Set(guias.flatMap((g) => [...canalesConProgramas(readFileSync(g, "utf8"))]));
  const canales = elegirCanales(ids, leerSitios(raizEpg), { intentados, conProgramas });
  writeFileSync(salida, aXml(canales));
  if (rutaIntentos) guardarIntentos(rutaIntentos, intentados ?? new Map(), canales);

  const porSitio = new Map();
  for (const c of canales) porSitio.set(c.site, (porSitio.get(c.site) ?? 0) + 1);
  console.log(`${canales.length} canales → ${salida}`);
  for (const [site, n] of [...porSitio].sort((a, b) => b[1] - a[1])) console.log(`  ${n} ${site}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  principal().catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  });
}
