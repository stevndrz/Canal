import { createHash } from "node:crypto";
import { open, readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { infoSubtitulo, slug, tituloDelNombre } from "./nombres.mjs";

/**
 * La biblioteca: lo que hay en la carpeta del PC.
 *
 * Es la fuente de verdad. Dos formas valen, y se pueden mezclar:
 *
 *   Peliculas\Interstellar (2014).mkv            ← suelta, con sus .srt al lado
 *   Peliculas\Interstellar (2014).es.srt           (los que empiezan igual)
 *
 *   Peliculas\Coco\lo-que-sea.1080p.mkv          ← en su carpeta: el título sale
 *   Peliculas\Coco\Coco.Spanish.srt                 de la carpeta, y todos los
 *                                                    subtítulos de dentro son suyos
 *
 * `subidas\` (donde el script viejo dejaba lo ya subido) se lee como una
 * carpeta más: lo que haya ahí ya está en la nube y se reconoce, no se sube
 * otra vez.
 */

export const VIDEOS = new Set([".mkv", ".mp4", ".m4v", ".mov", ".avi", ".webm", ".ts"]);
export const SUBTITULOS = new Set([".srt", ".vtt", ".ass", ".ssa"]);
/** Lo que deja a medias un navegador o un cliente de torrent. */
const A_MEDIAS = /\.(part|crdownload|!qb|!ut|tmp|download|opdownload)$/i;
/** Carpetas propias de la herramienta, que no son películas. */
const IGNORADAS = new Set([".canalcasa", "_trabajo", "$recycle.bin"]);
/** Un vídeo tocado hace menos de esto puede estar descargándose todavía. */
export const QUIETO_MS = 2 * 60_000;
/** Muestras que traen algunas descargas: no son la película. */
const MUESTRA = /(^|[\s._-])(sample|muestra|trailer)([\s._-]|$)/i;

/**
 * Huella rápida de un archivo de varios GB: tamaño + los primeros y los
 * últimos 4 MB. Leerlo entero tardaría un minuto por película; esto, nada, y
 * cambia si el archivo es otro (otra versión, otra calidad).
 */
export async function huellaDeVideo(ruta, tamano) {
  const trozo = 4 * 1024 * 1024;
  const hash = createHash("sha256").update(String(tamano));
  const archivo = await open(ruta, "r");
  try {
    const leer = async (desde, cuanto) => {
      const buf = Buffer.alloc(cuanto);
      const { bytesRead } = await archivo.read(buf, 0, cuanto, desde);
      hash.update(buf.subarray(0, bytesRead));
    };
    await leer(0, Math.min(trozo, tamano));
    if (tamano > trozo) await leer(Math.max(trozo, tamano - trozo), Math.min(trozo, tamano - trozo));
  } finally {
    await archivo.close();
  }
  return hash.digest("hex").slice(0, 16);
}

export async function huellaDeArchivo(ruta) {
  return createHash("sha256").update(await readFile(ruta)).digest("hex").slice(0, 16);
}

async function entradas(carpeta) {
  try {
    return await readdir(carpeta, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function datosSub(ruta) {
  const nombre = basename(ruta);
  return { ruta, nombre, huella: await huellaDeArchivo(ruta), ...infoSubtitulo(nombre) };
}

/**
 * Las películas que hay en `raiz`. `ahora` se inyecta para las pruebas.
 * Devuelve también lo que se saltó y por qué, para decirlo en pantalla.
 */
export async function leerBiblioteca(raiz, { ahora = Date.now() } = {}) {
  const peliculas = [];
  const saltadas = [];

  const considerar = async (rutaVideo, titulacion, subtitulos) => {
    const info = await stat(rutaVideo);
    if (ahora - info.mtimeMs < QUIETO_MS) {
      saltadas.push({ ruta: rutaVideo, motivo: "se está copiando o descargando (se tocó hace menos de 2 min)" });
      return;
    }
    const { titulo, anio } = tituloDelNombre(titulacion);
    peliculas.push({
      titulo,
      anio,
      id: slug(titulo),
      video: { ruta: rutaVideo, nombre: basename(rutaVideo), tamano: info.size, huella: await huellaDeVideo(rutaVideo, info.size) },
      subtitulos: await Promise.all(subtitulos.map(datosSub)),
    });
  };

  /** Una carpeta con vídeos sueltos (la raíz, `subidas`). */
  const sueltos = async (carpeta) => {
    const lista = await entradas(carpeta);
    const archivos = lista.filter((e) => e.isFile()).map((e) => e.name);
    const subs = archivos.filter((n) => SUBTITULOS.has(extname(n).toLowerCase()));
    for (const nombre of archivos) {
      const ext = extname(nombre).toLowerCase();
      if (A_MEDIAS.test(nombre)) {
        if (VIDEOS.has(extname(nombre.replace(A_MEDIAS, "")).toLowerCase())) {
          saltadas.push({ ruta: join(carpeta, nombre), motivo: "descarga a medias" });
        }
        continue;
      }
      if (!VIDEOS.has(ext) || MUESTRA.test(nombre)) continue;
      const base = nombre.slice(0, -ext.length).toLowerCase();
      // Los subtítulos sueltos son de la película cuyo nombre repiten:
      // «Interstellar (2014).mkv» ↔ «Interstellar (2014).es.srt».
      const suyos = subs.filter((s) => s.toLowerCase().startsWith(base + ".") || s.toLowerCase().startsWith(base + " "));
      await considerar(join(carpeta, nombre), nombre, suyos.map((s) => join(carpeta, s)));
    }
    return lista;
  };

  /** Una carpeta por película: la mayor es la película; los subtítulos, todos. */
  const enSuCarpeta = async (carpeta) => {
    const lista = (await entradas(carpeta)).filter((e) => e.isFile());
    const videos = [];
    for (const e of lista) {
      const ext = extname(e.name).toLowerCase();
      if (A_MEDIAS.test(e.name)) {
        saltadas.push({ ruta: join(carpeta, e.name), motivo: "descarga a medias" });
        continue;
      }
      if (VIDEOS.has(ext) && !MUESTRA.test(e.name)) {
        videos.push({ ruta: join(carpeta, e.name), tamano: (await stat(join(carpeta, e.name))).size });
      }
    }
    if (videos.length === 0) return;
    videos.sort((a, b) => b.tamano - a.tamano);
    const subs = lista.filter((e) => SUBTITULOS.has(extname(e.name).toLowerCase())).map((e) => join(carpeta, e.name));
    await considerar(videos[0].ruta, basename(carpeta), subs);
  };

  const raizLista = await sueltos(raiz);
  for (const e of raizLista) {
    if (!e.isDirectory() || IGNORADAS.has(e.name.toLowerCase())) continue;
    if (e.name.toLowerCase() === "subidas") await sueltos(join(raiz, e.name));
    else await enSuCarpeta(join(raiz, e.name));
  }

  // Dos archivos que dan el mismo título (dos versiones de lo mismo): se
  // queda el más grande y se avisa del otro, en vez de subir los dos.
  const porId = new Map();
  for (const p of peliculas) {
    const otra = porId.get(p.id);
    if (!otra) porId.set(p.id, p);
    else {
      const [queda, sobra] = p.video.tamano > otra.video.tamano ? [p, otra] : [otra, p];
      porId.set(p.id, queda);
      saltadas.push({ ruta: sobra.video.ruta, motivo: `otra copia de «${queda.titulo}» (se usa ${queda.video.nombre})` });
    }
  }
  return { peliculas: [...porId.values()], saltadas };
}
