#!/usr/bin/env node
/**
 * Revisión de la lista M3U entera (el gist): qué canales responden y cuáles no.
 *
 *   node scripts/revisar-lista.mjs                 → revisa y escribe en ./revision-lista/
 *   LISTA_URL=… LIMITE=200 node scripts/revisar-lista.mjs
 *
 * Deja en `revision-lista/`:
 * - `informe.md`: resumen y caídos, primero los que llevan más semanas.
 * - `lista-limpia.m3u`: la misma lista SIN los caídos dos revisiones seguidas.
 *   No se publica sola: es un borrador para revisarlo y pegarlo en el gist.
 * - `historial.json`: fallos seguidos por URL. El flujo semanal lo guarda en
 *   caché para la semana siguiente; sin él, todo cuenta como primera vez.
 *
 * Por qué dos semanas y no una: un canal puede estar caído un rato, o no emitir
 * a esa hora. Y lo bloqueado por país (403 de CloudFront «from your country»,
 * 451) se cuenta aparte y NUNCA se quita: GitHub revisa desde EE. UU., y desde
 * Guatemala ese canal puede verse perfectamente.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const LISTA_URL =
  process.env.LISTA_URL ||
  "https://gist.githubusercontent.com/stevndrz/8249817782d5a3c659f963f565916243/raw/gistfile1.txt";
const LIMITE = Number(process.env.LIMITE) || Infinity;
const DIR = "revision-lista";
const SIMULTANEAS = 48;
const TIEMPO_MS = 12_000;
const SEMANAS_PARA_QUITAR = 2;
const MAX_FILAS = 300;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

/** `#EXTINF` + la URL que le sigue. Se guardan las líneas tal cual para rehacer la lista. */
function leerLista(texto) {
  const lineas = texto.split(/\r?\n/);
  const cabecera = [];
  const entradas = [];
  let pendiente = [];
  for (const linea of lineas) {
    if (linea.startsWith("#EXTM3U")) cabecera.push(linea);
    else if (linea.startsWith("#")) pendiente.push(linea);
    else if (linea.trim()) {
      const extinf = pendiente.find((l) => l.startsWith("#EXTINF")) ?? "";
      entradas.push({
        lineas: [...pendiente, linea],
        url: linea.trim(),
        nombre: extinf.slice(extinf.lastIndexOf(",") + 1).trim() || linea.trim(),
        pais: extinf.match(/tvg-id="[^"]*\.([a-z]{2})(?:@[^"]*)?"/i)?.[1]?.toLowerCase() ?? "",
      });
      pendiente = [];
    }
  }
  return { cabecera, entradas };
}

/** Pide la URL y lee solo el principio: con eso basta para saber si es una lista HLS. */
async function sondear(url) {
  try {
    const r = await fetch(url, {
      headers: { "user-agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(TIEMPO_MS),
    });
    let inicio = "";
    if (r.body) {
      const lector = r.body.getReader();
      const { value } = await lector.read();
      inicio = new TextDecoder().decode(value ?? new Uint8Array()).slice(0, 2000);
      lector.cancel().catch(() => {});
    }
    const tipo = r.headers.get("content-type") ?? "";
    if (r.status === 451 || (r.status === 403 && /from your country|geo|region/i.test(inicio))) {
      return { estado: "pais", motivo: `HTTP ${r.status}` };
    }
    if (r.ok && (inicio.trimStart().startsWith("#EXTM3U") || /mpegurl|video|octet-stream|mp2t/i.test(tipo))) {
      return { estado: "ok" };
    }
    return { estado: "caido", motivo: r.ok ? "responde, pero no es vídeo" : `HTTP ${r.status}` };
  } catch (error) {
    const codigo = error?.cause?.code || error?.name || "error";
    return { estado: "caido", motivo: codigo === "TimeoutError" ? `sin respuesta en ${TIEMPO_MS / 1000}s` : codigo };
  }
}

async function enParalelo(elementos, tarea) {
  const resultados = new Array(elementos.length);
  let siguiente = 0;
  await Promise.all(
    Array.from({ length: SIMULTANEAS }, async () => {
      while (siguiente < elementos.length) {
        const i = siguiente++;
        resultados[i] = await tarea(elementos[i]);
      }
    }),
  );
  return resultados;
}

const respuesta = await fetch(LISTA_URL, { signal: AbortSignal.timeout(30_000) });
if (!respuesta.ok) {
  console.error(`No se pudo descargar la lista: HTTP ${respuesta.status}`);
  process.exit(1);
}
const { cabecera, entradas: todas } = leerLista(await respuesta.text());
const entradas = todas.slice(0, LIMITE);

// Las URLs repetidas se piden una vez.
const unicas = [...new Set(entradas.map((e) => e.url))];
const resultado = new Map();
const primera = await enParalelo(unicas, sondear);
unicas.forEach((url, i) => resultado.set(url, primera[i]));
// Segunda oportunidad a los caídos: un corte de un segundo no es un canal muerto.
const reintentar = unicas.filter((url) => resultado.get(url).estado === "caido");
const segunda = await enParalelo(reintentar, sondear);
reintentar.forEach((url, i) => {
  if (segunda[i].estado !== "caido") resultado.set(url, segunda[i]);
});

mkdirSync(DIR, { recursive: true });
const rutaHistorial = `${DIR}/historial.json`;
const previo = existsSync(rutaHistorial) ? JSON.parse(readFileSync(rutaHistorial, "utf8")) : {};
const hoy = new Date().toISOString().slice(0, 10);
const historial = {};
for (const url of unicas) {
  if (resultado.get(url).estado !== "caido") continue;
  historial[url] = { semanas: (previo[url]?.semanas ?? 0) + 1, desde: previo[url]?.desde ?? hoy };
}
writeFileSync(rutaHistorial, JSON.stringify(historial));

const quitar = (e) => (historial[e.url]?.semanas ?? 0) >= SEMANAS_PARA_QUITAR;
const limpia = [...cabecera, ...entradas.filter((e) => !quitar(e)).flatMap((e) => e.lineas)];
writeFileSync(`${DIR}/lista-limpia.m3u`, limpia.join("\n") + "\n");

const cuenta = (estado) => entradas.filter((e) => resultado.get(e.url).estado === estado).length;
const caidos = entradas
  .filter((e) => resultado.get(e.url).estado === "caido")
  .sort((a, b) => (historial[b.url].semanas - historial[a.url].semanas) || (a.pais === "gt" ? -1 : b.pais === "gt" ? 1 : 0));
const fila = (e) =>
  `| ${historial[e.url].semanas} | ${e.nombre.replaceAll("|", "/")} | ${e.pais || "—"} | ${resultado.get(e.url).motivo} | \`${e.url}\` |`;
const informe = [
  `## Revisión de la lista M3U — ${hoy}`,
  `**${entradas.length} canales:** ✅ ${cuenta("ok")} responden · ❌ ${cuenta("caido")} caídos · 🌎 ${cuenta("pais")} bloqueados por país (no se tocan).`,
  `**${entradas.filter(quitar).length}** llevan ${SEMANAS_PARA_QUITAR}+ revisiones seguidas caídos y ya NO están en \`lista-limpia.m3u\` (artefacto de esta ejecución).`,
  `### Caídos (primero los de más semanas; Guatemala delante)`,
  `| Semanas | Canal | País | Motivo | URL |\n|---|---|---|---|---|\n${caidos.slice(0, MAX_FILAS).map(fila).join("\n")}`,
  caidos.length > MAX_FILAS ? `_…y ${caidos.length - MAX_FILAS} más en el artefacto._` : "",
  `_Revisado desde los servidores de GitHub (EE. UU.)._`,
].join("\n\n");
writeFileSync(`${DIR}/informe.md`, informe + "\n");
console.log(informe.split("\n").slice(0, 6).join("\n"));
