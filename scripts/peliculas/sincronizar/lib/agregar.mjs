/**
 * «Agregar película» desde cualquier carpeta (USB, D:\, otra descarga): se
 * COPIA a la biblioteca, con sus subtítulos al lado y con el mismo nombre de
 * base, para que `leerBiblioteca` los empareje. El original no se toca.
 *
 *   - El vídeo se copia como «nombre.mkv.part» y se renombra al final: si se
 *     corta, la sincronización lo ve como descarga a medias y no lo sube roto.
 *   - Se le deja la fecha del original. Si no, la copia parecería recién
 *     descargada y se saltaría dos minutos.
 *   - Nunca sobrescribe: si ya hay otro archivo con ese nombre, « (2)».
 */

import { createReadStream, createWriteStream } from "node:fs";
import { copyFile, readdir, rename, rm, stat, statfs, utimes } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { SUBTITULOS, VIDEOS } from "./biblioteca.mjs";

const esVideo = (r) => VIDEOS.has(extname(r).toLowerCase());
const esSub = (r) => SUBTITULOS.has(extname(r).toLowerCase());
const base = (r) => basename(r, extname(r));

/**
 * De lo elegido en el selector, cada vídeo con sus subtítulos: los elegidos
 * que empiezan igual, los que estén a su lado con su nombre y, si se eligió un
 * solo vídeo, todos los subtítulos elegidos.
 */
export async function agrupar(rutas) {
  const videos = rutas.filter(esVideo);
  const subs = rutas.filter(esSub);
  if (videos.length === 0) throw new Error(subs.length ? "Elige también la película, no solo el subtítulo (o usa «+ Subtítulo» en su fila)." : "No elegiste ninguna película.");
  const grupos = [];
  for (const video of videos) {
    const b = base(video).toLowerCase();
    const empiezaIgual = (s) => basename(s).toLowerCase().startsWith(b + ".") || basename(s).toLowerCase().startsWith(b + " ");
    const elegidos = videos.length === 1 ? subs : subs.filter(empiezaIgual);
    let vecinos = [];
    try {
      vecinos = (await readdir(dirname(video))).map((n) => join(dirname(video), n)).filter((r) => esSub(r) && empiezaIgual(r));
    } catch {
      // Sin permiso para listar la carpeta de origen: solo lo elegido.
    }
    const todos = [...new Map([...elegidos, ...vecinos].map((s) => [s.toLowerCase(), s])).values()];
    grupos.push({ video, subtitulos: todos });
  }
  return grupos;
}

/** El nombre del subtítulo con la base del vídeo: «Coco.mkv» + «Coco.es.srt» o «spanish.srt». */
export function nombreDeSub(sub, baseOrigen, baseDestino) {
  const nombre = basename(sub);
  if (baseOrigen && nombre.toLowerCase().startsWith(baseOrigen.toLowerCase() + ".")) return baseDestino + nombre.slice(baseOrigen.length);
  if (nombre.toLowerCase().startsWith(baseDestino.toLowerCase() + ".")) return nombre;
  return `${baseDestino}.${nombre}`;
}

/** «Coco.mkv», o «Coco (2).mkv» si ya hay otro. Si es el mismo archivo (mismo tamaño), lo dice. */
export async function destinoLibre(carpeta, nombre, tamano) {
  const ext = extname(nombre);
  const b = nombre.slice(0, -ext.length || undefined);
  for (let n = 1; ; n++) {
    const candidato = join(carpeta, n === 1 ? nombre : `${b} (${n})${ext}`);
    const ya = await stat(candidato).catch(() => null);
    if (!ya) return { ruta: candidato, yaEsta: false };
    if (ya.size === tamano) return { ruta: candidato, yaEsta: true };
  }
}

/**
 * Falla, con las palabras de `que`, si en el disco de `carpeta` no caben
 * `bytes` (más un 5 %). Si no se pudo preguntar al disco, se sigue: mejor
 * intentarlo que negarse por no saber.
 */
export async function exigirSitio(carpeta, bytes, que = "copiarla") {
  let libre;
  try {
    libre = await statfs(carpeta).then((s) => s.bavail * s.bsize);
  } catch {
    return;
  }
  if (libre < bytes * 1.05) throw new Error(`No hay sitio en el disco para ${que}: hacen falta ${(bytes / 1024 ** 3).toFixed(1)} GB.`);
}

async function copiarConAvance(origen, destino, tamano, alAvance) {
  let copiado = 0;
  let ultimo = -1;
  const lector = createReadStream(origen, { highWaterMark: 4 * 1024 * 1024 });
  lector.on("data", (trozo) => {
    copiado += trozo.length;
    const p = tamano ? Math.floor((copiado / tamano) * 100) : 100;
    if (p !== ultimo) {
      ultimo = p;
      alAvance?.(p);
    }
  });
  await pipeline(lector, createWriteStream(destino));
}

/** Copia cada grupo a `raiz`. Devuelve lo que hizo, en palabras. */
export async function copiarALaBiblioteca(grupos, raiz, { alAvance, decir = () => {} } = {}) {
  const tamanos = await Promise.all(grupos.map((g) => stat(g.video).then((s) => s.size)));
  const total = tamanos.reduce((a, b) => a + b, 0);
  await exigirSitio(raiz, total);

  const hechos = [];
  for (const [i, { video, subtitulos }] of grupos.entries()) {
    const info = await stat(video);
    const { ruta, yaEsta } = await destinoLibre(raiz, basename(video), info.size);
    const titulo = base(ruta);
    if (yaEsta) {
      decir("info", `«${basename(video)}» ya estaba en la carpeta.`);
    } else {
      decir("info", `Copiando «${basename(video)}»…`);
      const parcial = `${ruta}.part`;
      await rm(parcial, { force: true });
      try {
        await copiarConAvance(video, parcial, info.size, (p) => alAvance?.({ titulo, porcentaje: p, cual: i + 1, de: grupos.length }));
        await utimes(parcial, info.atime, info.mtime);
        await rename(parcial, ruta);
      } catch (error) {
        await rm(parcial, { force: true });
        throw error;
      }
    }
    const subsCopiados = [];
    for (const s of subtitulos) {
      const destino = join(raiz, nombreDeSub(s, base(video), base(ruta)));
      if (await stat(destino).catch(() => null)) continue;
      await copyFile(s, destino);
      subsCopiados.push(basename(destino));
    }
    hechos.push({ video: basename(ruta), subtitulos: subsCopiados, yaEstaba: yaEsta });
  }
  alAvance?.(null);
  return hechos;
}

/** «+ Subtítulo» en una fila: al lado del vídeo, con su nombre (o dentro de su carpeta). */
export async function agregarSubtitulos(subs, rutaVideo, raiz) {
  const elegidos = subs.filter(esSub);
  if (elegidos.length === 0) throw new Error("Elige un archivo de subtítulos (.srt, .vtt, .ass).");
  const carpeta = dirname(rutaVideo);
  const enSuCarpeta = carpeta !== raiz && dirname(carpeta) === raiz;
  const copiados = [];
  for (const s of elegidos) {
    const nombre = enSuCarpeta ? basename(s) : nombreDeSub(s, null, base(rutaVideo));
    let destino = join(carpeta, nombre);
    for (let n = 2; await stat(destino).catch(() => null); n++) {
      const ext = extname(nombre);
      destino = join(carpeta, `${nombre.slice(0, -ext.length)}.${n}${ext}`);
    }
    await copyFile(s, destino);
    copiados.push(basename(destino));
  }
  return copiados;
}
