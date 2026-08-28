#!/usr/bin/env node
/**
 * Comprobador de addons de Stremio para `STREMIO_MANIFESTS`.
 *
 * El problema que resuelve: `fuentesDirectas` (src/lib/resolvers/stremio.ts)
 * descarta en silencio todo lo que no sea un enlace http(s) directo. Si el
 * addon que pusiste solo devuelve torrents —que es lo que devuelven casi todos
 * sin una cuenta de debrid detrás—, la ficha se queda exactamente igual que
 * antes y no hay ni un aviso que lo explique. Este script pone delante lo que
 * pasa: cuántos enlaces llegan, cuántos sobreviven al filtro y, sobre todo, si
 * los que sobreviven **responden de verdad**.
 *
 * Aplica LOS MISMOS filtros que la app, a propósito: lo que aquí sale como
 * «servirían» es literalmente lo que verías como botones «Directo · …».
 *
 * Uso:
 *   node scripts/probar-addon.mjs <url-addon> [<url-addon>…]
 *   node scripts/probar-addon.mjs                # usa STREMIO_MANIFESTS
 *   node scripts/probar-addon.mjs <url> --no-check      # sin verificar enlaces
 *   node scripts/probar-addon.mjs <url> --pelicula tt0111161
 *
 * La URL es la BASE del addon, la que lleva `/manifest.json` detrás — con su
 * trozo de configuración si lo tiene:
 *   https://torrentio.strem.fun/realdebrid=XXXX
 *
 * Sale con código 1 si ningún addon aporta enlaces utilizables, para poder
 * encadenarlo en un script.
 *
 * Sin dependencias: solo Node >= 20 (fetch global).
 */

/* ── CLI ─────────────────────────────────────────────────────────────── */
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const CHECK = !args.includes("--no-check");
/** Cadena Perpetua y «Winter Is Coming»: existen en cualquier catálogo serio. */
const PELICULA = flag("pelicula", "tt1375666");
const SERIE = flag("serie", "tt0944947:1:1");
const TIMEOUT_MS = Number(flag("timeout", 12000));

const bases = args.filter((arg) => /^https?:\/\//i.test(arg));
const manifiestos = (
  bases.length > 0 ? bases : (process.env.STREMIO_MANIFESTS ?? "").split(",")
)
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

if (manifiestos.length === 0) {
  console.error(
    "Falta la URL del addon.\n\n" +
      "  node scripts/probar-addon.mjs https://torrentio.strem.fun/realdebrid=TU_CLAVE\n\n" +
      "O define STREMIO_MANIFESTS y llámalo sin argumentos."
  );
  process.exit(2);
}

/* ── Utilidades ──────────────────────────────────────────────────────── */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

async function pedirJson(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * El MISMO filtro que `fuentesDirectas`. Si cambia allí, cambia aquí: el valor
 * de este script depende por completo de que las dos listas coincidan.
 */
function esUtilizable(stream) {
  if (!stream.url || stream.infoHash) return false;
  if (!/^https?:\/\//i.test(stream.url)) return false;
  if (/\.torrent($|\?)/i.test(stream.url)) return false;
  return true;
}

/**
 * ¿El enlace responde?
 *
 * Con `Range: bytes=0-1`: pide dos bytes en vez de la película entera. Un 200 o
 * un 206 valen; un 403 es lo típico de un enlace firmado contra otra IP, que es
 * el fallo que de otro modo solo se descubre dándole al play en el sofá.
 */
async function comprobarEnlace(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Range: "bytes=0-1", "User-Agent": UA },
    });
    const tipo = response.headers.get("content-type") ?? "?";
    return {
      ok: response.status === 200 || response.status === 206,
      detalle: `HTTP ${response.status} · ${tipo}`,
    };
  } catch (error) {
    return { ok: false, detalle: error.name === "TimeoutError" ? "sin respuesta" : error.message };
  }
}

async function revisarRuta(base, ruta, etiqueta) {
  let datos;
  try {
    datos = await pedirJson(`${base}${ruta}`);
  } catch (error) {
    console.log(`   ${etiqueta}: ✗ ${error.message}`);
    return [];
  }

  const streams = Array.isArray(datos?.streams) ? datos.streams : [];
  const utiles = streams.filter(esUtilizable);
  const torrents = streams.filter((stream) => stream.infoHash);
  const descartados = streams.length - utiles.length - torrents.length;

  const partes = [`${streams.length} en total`, `${utiles.length} servirían`];
  if (torrents.length > 0) partes.push(`${torrents.length} torrent (se descartan)`);
  if (descartados > 0) partes.push(`${descartados} sin URL usable`);
  console.log(`   ${etiqueta}: ${utiles.length > 0 ? "✓" : "·"} ${partes.join(" · ")}`);

  // La app se queda con los seis primeros; comprobar más es tiempo perdido.
  return utiles.slice(0, 6);
}

/* ── Recorrido ───────────────────────────────────────────────────────── */
console.log(`🔎 Comprobando ${manifiestos.length} addon(s)\n`);

let utilizablesEnTotal = 0;

for (const base of manifiestos) {
  console.log(`📦 ${base}`);

  try {
    const manifiesto = await pedirJson(`${base}/manifest.json`);
    const recursos = (manifiesto.resources ?? []).map((r) => (typeof r === "string" ? r : r.name));
    console.log(`   manifiesto: ✓ «${manifiesto.name ?? "sin nombre"}» · recursos: ${recursos.join(", ") || "ninguno"}`);
    if (!recursos.includes("stream")) {
      console.log("   ⚠️  No declara el recurso «stream»: este addon no sirve vídeo.");
    }
  } catch (error) {
    console.log(`   manifiesto: ✗ ${error.message}`);
    console.log("   ⚠️  Si es un 403, suele ser el addon bloqueando IPs de centro de datos.");
    console.log("       Ojo: la app lo pide desde el SERVIDOR, así que en Vercel fallaría igual.\n");
    continue;
  }

  const utiles = [
    ...(await revisarRuta(base, `/stream/movie/${PELICULA}.json`, `película ${PELICULA}`)),
    ...(await revisarRuta(base, `/stream/series/${SERIE.replaceAll(":", "%3A")}.json`, `serie    ${SERIE}`)),
  ];

  utilizablesEnTotal += utiles.length;

  if (utiles.length > 0 && CHECK) {
    console.log("   verificando que los enlaces respondan…");
    const resultados = await Promise.all(utiles.map((stream) => comprobarEnlace(stream.url)));
    resultados.forEach((resultado, i) => {
      const nombre = `${utiles[i].name ?? ""} ${utiles[i].title ?? ""}`.replace(/\s+/g, " ").trim();
      console.log(`     ${resultado.ok ? "✓" : "✗"} ${(nombre || "sin título").slice(0, 46).padEnd(46)} ${resultado.detalle}`);
    });
    const vivos = resultados.filter((resultado) => resultado.ok).length;
    if (vivos === 0) {
      console.log("   ⚠️  Llegan enlaces pero ninguno responde: suelen ir firmados contra la IP");
      console.log("       de quien los pidió, y la app los pide desde el servidor, no desde la tele.");
    }
  }

  console.log("");
}

/* ── Veredicto ───────────────────────────────────────────────────────── */
if (utilizablesEnTotal === 0) {
  console.log("❌ Ningún addon aportó enlaces directos.");
  console.log("   Casi siempre es lo mismo: el addon devuelve torrents y CanalCasa solo");
  console.log("   reproduce http(s) directo. Hace falta una URL de addon CONFIGURADA con");
  console.log("   un servicio de debrid, que es lo que convierte el torrent en un enlace.");
  process.exit(1);
}

console.log(`✅ ${utilizablesEnTotal} enlace(s) directo(s). Ya puedes ponerlo en STREMIO_MANIFESTS:`);
console.log(`   STREMIO_MANIFESTS="${manifiestos.join(",")}"`);
