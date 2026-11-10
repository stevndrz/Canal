/**
 * «Descargar desde un enlace»: se pega un enlace DIRECTO a un .mkv o .mp4 y
 * el PC lo baja a la carpeta de películas. Lo demás (convertir, subir) ya lo
 * hace la sincronización de siempre.
 *
 * Las mismas reglas que «Agregar película» (`agregar.mjs`):
 *   - se escribe «nombre.mkv.part» y se renombra al final: a medias, la
 *     sincronización lo ve como descarga sin terminar y no lo sube roto;
 *   - nunca sobrescribe: si ya hay otro archivo con ese nombre, « (2)»;
 *   - se comprueba antes que cabe en el disco.
 *
 * Y lo propio de bajar de internet:
 *   - solo http(s), y solo enlaces directos: si responde una página web se
 *     dice claro. No se resuelven páginas de descarga ni reproductores;
 *   - si se corta, se reintenta siguiendo por donde iba (`Range`), y un
 *     «.part» que quedó de otra vez se aprovecha si es del mismo archivo;
 *   - cancelar borra lo que iba bajado.
 */

import { createWriteStream } from "node:fs";
import { readFile, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { destinoLibre, exigirSitio } from "./agregar.mjs";
import { VIDEOS } from "./biblioteca.mjs";

const REINTENTOS = 4;
/** Tanto tiempo sin recibir nada es una conexión muerta, no una lenta. */
const SIN_DATOS_MS = 60_000;
/** La biblioteca no toca lo modificado hace menos de 2 min; una descarga ya terminada no tiene que esperar. */
const YA_QUIETO_MS = 5 * 60_000;

const TIPO_A_EXT = new Map([
  ["video/x-matroska", ".mkv"],
  ["video/matroska", ".mkv"],
  ["video/mp4", ".mp4"],
  ["video/webm", ".webm"],
  ["video/quicktime", ".mov"],
  ["video/x-msvideo", ".avi"],
  ["video/mp2t", ".ts"],
]);

/** Un error que se le enseña a la persona tal cual (no es un fallo del programa). */
export class ErrorDeEnlace extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.codigo = 400;
  }
}

/** El enlace escrito → una URL http(s), o un error que explica por qué no vale. */
export function leerEnlace(texto) {
  const limpio = String(texto ?? "").trim();
  if (!limpio) throw new ErrorDeEnlace("Pega el enlace de la película.");
  if (/^magnet:/i.test(limpio)) throw new ErrorDeEnlace("Eso es un magnet (torrent). Aquí solo valen enlaces directos que empiecen por http:// o https://.");
  let url;
  try {
    url = new URL(limpio);
  } catch {
    throw new ErrorDeEnlace("Eso no es un enlace. Tiene que empezar por http:// o https://.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ErrorDeEnlace("Solo valen enlaces que empiecen por http:// o https://.");
  if (url.username || url.password) throw new ErrorDeEnlace("El enlace lleva usuario y contraseña dentro. Usa uno sin ellos.");
  return url;
}

/** «filename*=UTF-8''Coco%20(2017).mkv» o «filename="Coco.mkv"» → el nombre, o "". */
export function nombreDeCabecera(disposicion) {
  if (!disposicion) return "";
  const extendido = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(disposicion);
  if (extendido) {
    try {
      return decodeURIComponent(extendido[1].trim());
    } catch {
      // Mal codificado: se prueba el otro.
    }
  }
  const llano = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/i.exec(disposicion);
  return (llano?.[1] ?? llano?.[2] ?? "").trim();
}

/**
 * Un nombre que Windows acepte, y sin carpetas: lo que mande el servidor no
 * puede escribir fuera de la biblioteca («..\..\Inicio\virus.mkv»).
 */
export function nombreSeguro(crudo) {
  let nombre = String(crudo ?? "").replace(/\\/g, "/");
  nombre = nombre.slice(nombre.lastIndexOf("/") + 1);
  // Fuera lo que Windows no admite en un nombre, y los caracteres de control.
  nombre = nombre.replace(/[<>:"|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().replace(/^\.+/, "").replace(/[. ]+$/, "");
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(nombre)) nombre = `_${nombre}`;
  if (nombre.length > 180) {
    const ext = extname(nombre);
    nombre = nombre.slice(0, 180 - ext.length).trim() + ext;
  }
  return nombre;
}

/**
 * Cómo se va a llamar el archivo: lo que diga el servidor (`Content-Disposition`),
 * o el final de la URL. Tiene que ser un vídeo de los que entiende la
 * biblioteca; si no trae extensión pero el servidor dice que es vídeo, se le pone.
 */
export function nombreDeDescarga({ disposicion, urlFinal, tipo }) {
  let deUrl = "";
  try {
    deUrl = decodeURIComponent(new URL(urlFinal).pathname.split("/").pop() ?? "");
  } catch {
    deUrl = new URL(urlFinal).pathname.split("/").pop() ?? "";
  }
  const medio = (tipo ?? "").split(";")[0].trim().toLowerCase();
  for (const candidato of [nombreDeCabecera(disposicion), deUrl]) {
    const nombre = nombreSeguro(candidato);
    if (!nombre) continue;
    if (VIDEOS.has(extname(nombre).toLowerCase())) return nombre;
    if (!extname(nombre) && TIPO_A_EXT.has(medio)) return nombre + TIPO_A_EXT.get(medio);
  }
  if (TIPO_A_EXT.has(medio)) return `Pelicula descargada${TIPO_A_EXT.get(medio)}`;
  const visto = nombreSeguro(nombreDeCabecera(disposicion) || deUrl);
  const ext = extname(visto);
  throw new ErrorDeEnlace(
    ext
      ? `Ese enlace baja «${visto}», que no es un vídeo (${ext}). Valen: ${[...VIDEOS].join(", ")}.`
      : "Ese enlace no dice que sea un vídeo. Tiene que ser un enlace directo a un .mkv o .mp4.",
  );
}

const esPagina = (tipo) => /^(text\/html|application\/xhtml)/i.test(tipo ?? "");

/** El total que anuncia la respuesta: `Content-Range: bytes 5-9/10` o `Content-Length`. */
function totalDe(respuesta, desde) {
  const rango = /\/(\d+)\s*$/.exec(respuesta.headers.get("content-range") ?? "");
  if (respuesta.status === 206 && rango) return Number(rango[1]);
  const largo = Number(respuesta.headers.get("content-length"));
  return Number.isFinite(largo) && largo > 0 ? largo + (respuesta.status === 206 ? desde : 0) : null;
}

function explicarEstado(estado) {
  if (estado === 404 || estado === 410) return "Ese enlace ya no existe (el servidor dice que no encuentra el archivo). Puede que haya caducado.";
  if (estado === 401 || estado === 403) return "El servidor no deja bajar ese enlace (pide iniciar sesión o el enlace caducó).";
  if (estado === 429) return "El servidor dice que son demasiadas descargas. Prueba dentro de un rato.";
  return `El servidor contestó con un error (${estado}). Prueba otra vez o con otro enlace.`;
}

/**
 * Baja `enlace` a `raiz`. Devuelve `{ video, yaEstaba, bytes }`.
 *
 * `senal` cancela (y borra lo bajado); `alAvance({ titulo, porcentaje })` con
 * `porcentaje: null` si el servidor no dice cuánto pesa.
 */
export async function descargarALaBiblioteca(enlace, raiz, { alAvance, decir = () => {}, senal, pedir = fetch, reintentos = REINTENTOS, sinDatosMs = SIN_DATOS_MS, espera = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const url = leerEnlace(enlace);
  let destino = null; // { ruta, parcial, info, titulo, total, validador }
  let ultimoError = null;

  const cancelado = () => Boolean(senal?.aborted);
  const limpiar = async () => {
    if (!destino) return;
    await rm(destino.parcial, { force: true });
    await rm(destino.info, { force: true });
  };

  try {
    for (let intento = 0; intento <= reintentos; intento++) {
      if (cancelado()) break;
      if (intento > 0) {
        decir("aviso", `Se cortó la descarga (${ultimoError?.message ?? "sin motivo"}). Sigo por donde iba… (intento ${intento + 1})`);
        await espera(Math.min(1000 * 2 ** (intento - 1), 15_000));
        if (cancelado()) break;
      }

      // Lo que ya hay bajado de ESTE archivo (de un intento anterior o de otra vez).
      let desde = destino ? await stat(destino.parcial).then((s) => s.size, () => 0) : 0;

      const corte = new AbortController();
      const alCancelar = () => corte.abort();
      senal?.addEventListener("abort", alCancelar, { once: true });
      let reloj = null;
      const darCuerda = () => {
        clearTimeout(reloj);
        reloj = setTimeout(() => corte.abort(new Error("el servidor dejó de mandar datos")), sinDatosMs);
      };

      try {
        darCuerda();
        const cabeceras = { "User-Agent": "CanalCasa/1.0", Accept: "*/*", "Accept-Encoding": "identity" };
        if (desde > 0) {
          cabeceras.Range = `bytes=${desde}-`;
          if (destino.validador) cabeceras["If-Range"] = destino.validador;
        }
        const respuesta = await pedir(url, { headers: cabeceras, redirect: "follow", signal: corte.signal });
        const tipo = respuesta.headers.get("content-type") ?? "";

        if (respuesta.status === 416 && desde > 0) {
          // Lo bajado no encaja con lo que hay ahora en el servidor: de cero.
          await respuesta.body?.cancel().catch(() => {});
          await limpiar();
          ultimoError = new Error("el archivo cambió en el servidor");
          continue;
        }
        if (!respuesta.ok) {
          await respuesta.body?.cancel().catch(() => {});
          // Un 5xx puede ser pasajero; un 4xx no va a cambiar por insistir.
          if (respuesta.status >= 500) {
            ultimoError = new Error(explicarEstado(respuesta.status));
            continue;
          }
          throw new ErrorDeEnlace(explicarEstado(respuesta.status));
        }
        if (esPagina(tipo)) {
          await respuesta.body?.cancel().catch(() => {});
          throw new ErrorDeEnlace("Ese enlace abre una página web, no el vídeo. Hace falta el enlace directo al archivo (el que acaba en .mkv o .mp4), no el de la página donde está el botón de descargar.");
        }
        if (!respuesta.body) throw new Error("el servidor no mandó nada");

        const sigue = respuesta.status === 206 && desde > 0;
        if (!sigue) desde = 0;
        const total = totalDe(respuesta, desde);

        if (!destino) {
          const nombre = nombreDeDescarga({ disposicion: respuesta.headers.get("content-disposition"), urlFinal: respuesta.url || url.href, tipo });
          const { ruta, yaEsta } = await destinoLibre(raiz, nombre, total ?? -1);
          if (yaEsta) {
            await respuesta.body.cancel().catch(() => {});
            decir("info", `«${basename(ruta)}» ya estaba en la carpeta.`);
            alAvance?.(null);
            return { video: basename(ruta), yaEstaba: true, bytes: 0 };
          }
          destino = {
            ruta,
            parcial: `${ruta}.part`,
            info: `${ruta}.part.info`,
            titulo: basename(ruta, extname(ruta)),
            total,
            validador: respuesta.headers.get("etag") || respuesta.headers.get("last-modified") || "",
            modificado: Date.parse(respuesta.headers.get("last-modified") ?? ""),
          };
          // ¿Quedó un «.part» de otra vez? Solo vale si es del mismo enlace y del mismo archivo.
          const previo = await readFile(destino.info, "utf8").then(JSON.parse, () => null);
          const bajado = await stat(destino.parcial).then((s) => s.size, () => 0);
          const mismo = previo && previo.url === url.href && previo.total === total && previo.validador === destino.validador;
          if (bajado > 0 && mismo && total && bajado < total && /bytes/i.test(respuesta.headers.get("accept-ranges") ?? "")) {
            await respuesta.body.cancel().catch(() => {});
            decir("info", `Había ${Math.floor((bajado / total) * 100)} % bajado de otra vez: sigo desde ahí.`);
            intento -= 1; // Esto no fue un fallo.
            continue;
          }
          await rm(destino.parcial, { force: true });
          if (total) await exigirSitio(raiz, total, "bajarla");
          await writeFile(destino.info, JSON.stringify({ url: url.href, total, validador: destino.validador }), "utf8");
          decir("info", `Descargando «${basename(ruta)}»${total ? ` (${(total / 1024 ** 3).toFixed(2)} GB)` : ""}…`);
        } else if (total && destino.total && total !== destino.total) {
          // A mitad de camino el servidor ya sirve otra cosa: de cero.
          await respuesta.body.cancel().catch(() => {});
          await rm(destino.parcial, { force: true });
          destino.total = total;
          ultimoError = new Error("el archivo cambió en el servidor");
          continue;
        }

        let bajado = desde;
        let ultimo = -1;
        const avisar = () => {
          const p = destino.total ? Math.min(100, Math.floor((bajado / destino.total) * 100)) : null;
          if (p === ultimo) return;
          ultimo = p;
          alAvance?.({ titulo: destino.titulo, porcentaje: p });
        };
        avisar();
        const contar = new Transform({
          transform(trozo, _c, hecho) {
            bajado += trozo.length;
            darCuerda();
            avisar();
            hecho(null, trozo);
          },
        });
        await pipeline(Readable.fromWeb(respuesta.body), contar, createWriteStream(destino.parcial, { flags: sigue ? "a" : "w" }), { signal: corte.signal });

        if (destino.total && bajado !== destino.total) {
          ultimoError = new Error(`llegaron ${bajado} de ${destino.total} bytes`);
          continue;
        }
        if (bajado === 0) throw new ErrorDeEnlace("Ese enlace baja un archivo vacío.");

        const fecha = Number.isFinite(destino.modificado) && destino.modificado < Date.now() - YA_QUIETO_MS ? new Date(destino.modificado) : new Date(Date.now() - YA_QUIETO_MS);
        await utimes(destino.parcial, fecha, fecha);
        await rename(destino.parcial, destino.ruta);
        await rm(destino.info, { force: true });
        alAvance?.(null);
        return { video: basename(destino.ruta), yaEstaba: false, bytes: bajado };
      } catch (error) {
        if (error instanceof ErrorDeEnlace || cancelado()) throw error;
        if (error instanceof Error && error.message.startsWith("No hay sitio")) throw error;
        // Corte de red, o el servidor se quedó mudo: se reintenta.
        ultimoError = corte.signal.aborted && corte.signal.reason instanceof Error ? corte.signal.reason : error;
      } finally {
        clearTimeout(reloj);
        senal?.removeEventListener("abort", alCancelar);
      }
    }

    if (cancelado()) throw new ErrorDeEnlace("Descarga cancelada.");
    throw new Error(
      destino
        ? `No pude terminar la descarga (${ultimoError?.message ?? "se cortó"}). Lo bajado queda guardado: pega el mismo enlace otra vez y sigo por donde iba.`
        : `No pude conectar con ese enlace (${ultimoError?.cause?.code ?? ultimoError?.message ?? "sin respuesta"}). Revisa que esté bien copiado y que haya internet.`,
    );
  } catch (error) {
    alAvance?.(null);
    // Cancelar o un enlace que no vale: no se deja basura. Un corte sí deja el «.part», para seguir.
    if (cancelado() || error instanceof ErrorDeEnlace) await limpiar();
    if (cancelado()) throw new ErrorDeEnlace("Descarga cancelada.");
    throw error;
  }
}
