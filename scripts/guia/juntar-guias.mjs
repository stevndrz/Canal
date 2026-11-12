#!/usr/bin/env node
/**
 * Junta las guías de cada ronda (`armar-canales.mjs`) en una sola, comprimida.
 *
 *   node scripts/guia/juntar-guias.mjs guia-1.xml guia-2.xml … --salida publicar/guia.xml.gz
 *
 * - Un canal sale una sola vez: manda la primera guía que le trae programas.
 *   Mezclar dos sitios en el mismo canal daría programas solapados.
 * - Si el resultado es casi nada (un sitio caído, un cambio en iptv-org), sale
 *   con error y NO escribe: la guía publicada del día anterior se queda, que
 *   todavía cubre unas horas, en vez de pisarla con una vacía.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";

/** Por debajo de esto algo se rompió: hoy salen unos 6.000 programas. */
export const MINIMO_PROGRAMAS = 1000;

const idDe = (bloque) => bloque.match(/\bchannel="([^"]+)"/)?.[1] ?? bloque.match(/\bid="([^"]+)"/)?.[1] ?? "";

export function juntar(guias) {
  const canales = new Map();
  const programas = [];
  const servidos = new Set();
  for (const xml of guias) {
    const deEsta = new Set();
    for (const [bloque] of xml.matchAll(/<programme\b[\s\S]*?<\/programme>/g)) {
      const id = idDe(bloque);
      if (!id || servidos.has(id)) continue;
      deEsta.add(id);
      programas.push(bloque);
    }
    for (const id of deEsta) servidos.add(id);
    for (const [bloque] of xml.matchAll(/<channel\b[\s\S]*?<\/channel>/g)) {
      const id = idDe(bloque);
      if (id && deEsta.has(id) && !canales.has(id)) canales.set(id, bloque);
    }
  }
  const fecha = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const xml = `<?xml version="1.0" encoding="UTF-8" ?><tv date="${fecha}" generator-info-name="CanalCasa (iptv-org/epg)">\n${[...canales.values(), ...programas].join("\n")}\n</tv>\n`;
  return { xml, canales: canales.size, programas: programas.length };
}

function principal() {
  const args = process.argv.slice(2);
  const i = args.indexOf("--salida");
  const salida = i >= 0 ? args[i + 1] : "guia.xml.gz";
  const entradas = args.filter((a, j) => a !== "--salida" && j !== i + 1);
  const leidas = entradas.flatMap((ruta) => {
    try {
      return [readFileSync(ruta, "utf8")];
    } catch {
      console.log(`(sin ${ruta}: esa ronda no hizo falta)`);
      return [];
    }
  });
  const { xml, canales, programas } = juntar(leidas);
  console.log(`${canales} canales, ${programas} programas`);
  if (programas < MINIMO_PROGRAMAS) {
    console.error(`❌ Solo ${programas} programas (mínimo ${MINIMO_PROGRAMAS}): no se publica, se queda la de ayer.`);
    process.exit(1);
  }
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(salida, gzipSync(xml, { level: 9 }));
  console.log(`→ ${salida}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) principal();
