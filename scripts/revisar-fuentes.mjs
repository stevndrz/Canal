#!/usr/bin/env node
/**
 * Revisión de fuentes: canales oficiales de Guatemala y servidores de cine.
 *
 *   node scripts/revisar-fuentes.mjs            → informe en Markdown
 *   node scripts/revisar-fuentes.mjs --salida informe.md
 *
 * Sale con código 1 si algo cayó; el flujo semanal
 * (.github/workflows/revisar-fuentes.yml) abre entonces un issue.
 *
 * Qué se comprueba, y qué NO:
 * - Canales (`src/lib/fuentes-oficiales.ts`): que el master responda 200 con
 *   `#EXTM3U`, igual el respaldo, y que la web de Chapin TV siga anunciando la
 *   misma URL. Si la cambian, el aviso trae la nueva.
 * - Cine (`src/lib/catalog/providers.ts`): solo que el dominio responda. Un 200
 *   de un embed no garantiza que reproduzca (ver el comentario en
 *   providers.ts), pero un 404, un 5xx o un dominio que no existe sí garantizan
 *   que está muerto. Un reto de Cloudflare cuenta como vivo.
 *
 * Lee los .ts como texto a propósito: importarlos arrastraría la config y los
 * alias `@/` de Next. Si cambia la forma de esos archivos, el script avisa de
 * que no encontró nada en vez de dar todo por bueno.
 */
import { readFileSync, writeFileSync } from "node:fs";

const RAIZ = new URL("..", import.meta.url);
const leer = (ruta) => readFileSync(new URL(ruta, RAIZ), "utf8");
const TIEMPO_MS = 15_000;
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
/** Película de prueba para las plantillas de cine: Matrix, la tienen todos. */
const TMDB_PRUEBA = "603";

/** Las páginas de directo de Chapin TV, por id de su plataforma. */
const PAGINAS_CHAPIN = {
  i8bocdjcqa5r: "https://www.chapintv.com/envivo-canal-3/",
  hm8maie2jnn2: "https://www.chapintv.com/envivo-canal-7/",
  by1ualyjwslr: "https://www.chapintv.com/envivo-canal-23/",
};

async function pedir(url, extra = {}) {
  try {
    const r = await fetch(url, {
      headers: { "user-agent": UA, ...extra },
      redirect: "follow",
      signal: AbortSignal.timeout(TIEMPO_MS),
    });
    const texto = await r.text();
    return { estado: r.status, texto, cabeceras: r.headers };
  } catch (error) {
    return { estado: 0, texto: "", error: error?.cause?.code || error?.name || String(error) };
  }
}

async function revisarM3u8(url) {
  const r = await pedir(url, { origin: "https://canalcasa.invalid" });
  const ok = r.estado === 200 && r.texto.trimStart().startsWith("#EXTM3U");
  const cors = r.cabeceras?.get("access-control-allow-origin") === "*";
  const detalle = r.error ? r.error : `HTTP ${r.estado}${ok && !cors ? ", sin CORS" : ""}`;
  return { ok: ok && cors, detalle };
}

async function revisarCanales() {
  const fuente = leer("src/lib/fuentes-oficiales.ts");
  const filas = [...fuente.matchAll(/"([a-z0-9]+\.gt)":\s*deChapinTv\("([a-z0-9]+)"\)/g)];
  if (filas.length === 0) return [{ nombre: "fuentes-oficiales.ts", ok: false, detalle: "no se encontró ningún canal (¿cambió el formato?)" }];

  const principal = (id) => `https://ddycmnicl95kp.cloudfront.net/live/${id}/master.m3u8`;
  const respaldo = (id) => `https://d6qmllupbc5d2.cloudfront.net/hls/${id}/index.m3u8`;

  return Promise.all(
    filas.map(async ([, canal, id]) => {
      const [p, s] = await Promise.all([revisarM3u8(principal(id)), revisarM3u8(respaldo(id))]);
      const avisos = [];
      if (!p.ok) avisos.push(`principal: ${p.detalle}`);
      if (!s.ok) avisos.push(`respaldo: ${s.detalle}`);

      const pagina = PAGINAS_CHAPIN[id];
      if (pagina) {
        const web = await pedir(pagina);
        const anunciada = web.texto.match(/"streamUrl":"([^"]*)"/)?.[1]?.replaceAll("\\/", "/") ?? "";
        if (!anunciada) avisos.push(`la web no trae streamUrl (${web.error || `HTTP ${web.estado}`})`);
        else if (!anunciada.split("#")[0].includes(`/${id}/`)) avisos.push(`la web ahora usa ${anunciada}`);
      }
      return { nombre: canal, ok: avisos.length === 0, detalle: avisos.join("; ") || "principal y respaldo 200 #EXTM3U" };
    }),
  );
}

async function revisarCine() {
  const fuente = leer("src/lib/catalog/providers.ts");
  const bloques = [...fuente.matchAll(/id:\s*"([^"]+)",\s*movie:\s*[`"]([^`"]+)[`"]/g)];
  if (bloques.length === 0) return [{ nombre: "providers.ts", ok: false, detalle: "no se encontró ningún servidor (¿cambió el formato?)" }];

  return Promise.all(
    bloques.map(async ([, id, plantilla]) => {
      // Con una clave interpolada (`${…}`) no se puede armar la URL: basta el dominio.
      const url = plantilla.includes("${") ? new URL(plantilla.split("?")[0]).origin + "/" : plantilla.replaceAll("{tmdbId}", TMDB_PRUEBA);
      const r = await pedir(url);
      const reto = r.cabeceras?.get("cf-mitigated") === "challenge";
      const ok = r.estado > 0 && (r.estado < 400 || reto);
      const detalle = r.error || `HTTP ${r.estado}${reto ? " (reto de Cloudflare: normal)" : ""}`;
      return { nombre: id, ok, detalle };
    }),
  );
}

const [canales, cine] = await Promise.all([revisarCanales(), revisarCine()]);
const tabla = (filas) => ["| | Fuente | Detalle |", "|---|---|---|", ...filas.map((f) => `| ${f.ok ? "✅" : "❌"} | ${f.nombre} | ${f.detalle} |`)].join("\n");
const caidos = [...canales, ...cine].filter((f) => !f.ok);
const informe = [
  `## Revisión de fuentes — ${new Date().toISOString().slice(0, 10)}`,
  caidos.length ? `**${caidos.length} caída(s):** ${caidos.map((f) => f.nombre).join(", ")}` : "Todo responde.",
  "### Canales de Guatemala",
  tabla(canales),
  "### Servidores de cine (solo dominio: un ✅ no garantiza que reproduzca)",
  tabla(cine),
  "_Revisado desde fuera de Guatemala: lo que solo falla en casa no se ve aquí._",
].join("\n\n");

const i = process.argv.indexOf("--salida");
if (i > 0 && process.argv[i + 1]) writeFileSync(process.argv[i + 1], informe + "\n");
console.log(informe);
process.exitCode = caidos.length ? 1 : 0;
