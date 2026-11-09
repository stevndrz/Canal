import { mkdir, readFile, readdir, rm, stat, statfs, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { leerBiblioteca } from "./biblioteca.mjs";
import { analizar, argumentosHls, argumentosVideo, esUtf8, filtrosDeVideo, maestraConNombres, modosAProbar, subtitulosInternos } from "./ffmpeg.mjs";
import { carpetaDe, describir, planificar } from "./plan.mjs";

/**
 * Sincronizar: dejar la nube como la carpeta.
 *
 * Recibe todo lo que toca el mundo de fuera —la nube, cómo lanzar programas,
 * cómo preguntar y cómo contar— para que una prueba pueda pasarle una nube
 * que es una carpeta y un `preguntar` que contesta solo.
 *
 * Reglas que no se saltan:
 *   - NADA se borra de la nube sin preguntar, y por defecto la respuesta es no.
 *   - Una película se sube a una carpeta NUEVA (`<id>-<huella>`), se comprueba
 *     que llegó entera y solo entonces se apunta en el catálogo. Si algo se
 *     corta a la mitad, la app no ve una película rota: ve la de antes, o nada.
 *   - El catálogo se guarda después de cada paso: si el quinto falla, los
 *     cuatro primeros quedan hechos.
 *
 * Con `automatico` (la tarea programada, sin nadie al teclado) no se pregunta
 * nada: lo que solo AÑADE —subir, renombrar, subtítulos nuevos— se hace, y
 * todo lo que quitaría algo de la nube —una película que ya no está, un
 * reemplazo, un subtítulo borrado, pasarse del plan gratis— se deja como
 * estaba y se devuelve en `pendientes`, para hacerlo a mano.
 */

/** El plan gratis de R2: 10 GB. Se avisa antes de pasarse. */
export const LIMITE_NUBE = 10 * 1024 ** 3;

export async function sincronizar({ raiz, trabajo, nube, ejecutar, preguntar, decir, opciones = {} }) {
  const op = {
    mirar: false,
    automatico: false,
    calidad: 24,
    aceleracion: "auto",
    recodificar: false,
    audio: "spa",
    idiomasSubs: ["spa", "eng"],
    ahora: Date.now(),
    ...opciones,
  };
  const resumen = { hechas: 0, fallidas: 0, saltadas: 0, pendientes: [], subidas: [] };

  decir("titulo", `Leyendo ${raiz}`);
  const { peliculas: locales, saltadas } = await leerBiblioteca(raiz, { ahora: op.ahora });
  decir("titulo", `Leyendo la nube (${nube.descripcion})`);
  const catalogo = await nube.leerCatalogo();
  const carpetasNube = await nube.listarCarpetas();
  const planEntero = planificar(locales, catalogo, { carpetasNube });
  const plan = op.automatico ? soloLoQueAnade(planEntero, resumen.pendientes) : planEntero;

  decir("info", `En la carpeta: ${locales.length} película(s). En la nube: ${catalogo.length}.`);
  for (const s of saltadas) decir("aviso", `Se salta ${s.ruta}: ${s.motivo}`);
  for (const p of resumen.pendientes) decir("aviso", `Pendiente (hazlo a mano con «Sincronizar peliculas»): ${p}`);
  if (plan.length === 0) {
    if (resumen.pendientes.length === 0) decir("bien", "Todo al día: la nube ya es igual que la carpeta.");
    return { ...resumen, plan };
  }
  decir("titulo", "Lo que hay que hacer");
  for (const a of plan) decir(a.tipo === "huerfana" || a.tipo === "basura" ? "aviso" : "info", describir(a));
  if (op.mirar) {
    decir("info", "(Solo mirar: no se ha hecho nada.)");
    return { ...resumen, plan };
  }

  const constructivas = plan.filter((a) => !["huerfana", "basura"].includes(a.tipo));
  if (constructivas.length > 0 && !op.automatico && !(await preguntar("¿Lo hago?", true))) {
    decir("info", "No se hizo nada.");
    return { ...resumen, plan };
  }

  // Espacio en la nube, antes de convertir horas para nada.
  const aSubir = plan.filter((a) => a.tipo === "subir" || a.tipo === "reemplazar");
  if (aSubir.length > 0) {
    const usado = await nube.tamanoTotal();
    const nuevo = aSubir.reduce((t, a) => t + a.local.video.tamano, 0);
    if (usado !== null && usado + nuevo > LIMITE_NUBE * 0.95) {
      decir("aviso", `La nube tiene ${gb(usado)} de ${gb(LIMITE_NUBE)} gratis, y esto suma hasta ${gb(nuevo)} más. Puede pasarse del plan gratis (R2 cobra lo que sobre).`);
      if (op.automatico) {
        // Sin nadie que decida, no se arriesga la factura: lo demás sí se hace.
        for (const a of aSubir) {
          plan.splice(plan.indexOf(a), 1);
          resumen.pendientes.push(`Subir «${a.local.titulo}»: no cabe en los ${gb(LIMITE_NUBE)} gratis (hay ${gb(usado)}). Borra alguna antes.`);
          decir("aviso", resumen.pendientes.at(-1));
        }
      } else if (!(await preguntar("¿Sigo de todas formas?", false))) {
        decir("info", "No se subió nada. Borra alguna película de la carpeta y vuelve a sincronizar.");
        return { ...resumen, plan };
      }
    }
  }

  const guardar = () => nube.escribirCatalogo(catalogo);
  const orden = ["adoptar", "renombrar", "subtitulos", "subir", "reemplazar", "huerfana", "basura"];
  const ordenado = [...plan].sort((a, b) => orden.indexOf(a.tipo) - orden.indexOf(b.tipo));

  for (const accion of ordenado) {
    try {
      const hizo = await ejecutarAccion(accion, { catalogo, nube, ejecutar, preguntar, decir, trabajo, op });
      if (hizo === "sin-catalogo") resumen.hechas++;
      else if (hizo) {
        await guardar();
        resumen.hechas++;
        if (accion.tipo === "subir") resumen.subidas.push(accion.local.titulo);
      } else resumen.saltadas++;
    } catch (error) {
      resumen.fallidas++;
      decir("error", `${describir(accion)}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { ...resumen, plan };
}

/**
 * Del plan, lo que se puede hacer sin preguntar: lo que no quita nada de la
 * nube. Lo demás se describe en `pendientes` y no se toca.
 */
export function soloLoQueAnade(plan, pendientes) {
  const hacer = [];
  for (const a of plan) {
    if (a.tipo === "huerfana" || a.tipo === "basura" || a.tipo === "reemplazar") {
      pendientes.push(describir(a));
    } else if (a.tipo === "subtitulos" && a.quitar.length > 0) {
      pendientes.push(`Quitar de «${a.entrada.titulo}» ${a.quitar.length} subtítulo(s) que ya no están en la carpeta`);
      if (a.nuevos.length > 0 || (a.adoptarSubs?.length ?? 0) > 0) hacer.push({ ...a, quitar: [] });
    } else {
      hacer.push(a);
    }
  }
  return hacer;
}

async function ejecutarAccion(accion, ctx) {
  const { catalogo, nube, preguntar, decir } = ctx;
  switch (accion.tipo) {
    case "adoptar": {
      accion.entrada.origen = origenDe(accion.local);
      decir("bien", `«${accion.entrada.titulo}» reconocida.`);
      return true;
    }
    case "renombrar": {
      accion.entrada.titulo = accion.titulo;
      accion.entrada.origen = origenDe(accion.local);
      decir("bien", `Ahora se llama «${accion.titulo}».`);
      return true;
    }
    case "subtitulos": {
      await actualizarSubtitulos(accion, ctx);
      decir("bien", `Subtítulos de «${accion.entrada.titulo}» al día.`);
      return true;
    }
    case "subir": {
      const entrada = await subirPelicula(accion.local, accion.id, ctx);
      catalogo.unshift(entrada);
      decir("bien", `«${entrada.titulo}» subida.`);
      return true;
    }
    case "reemplazar": {
      const vieja = carpetaDe(accion.entrada);
      if (!(await preguntar(`«${accion.entrada.titulo}» cambió de archivo. ¿La reemplazo en la nube por ${accion.local.video.nombre}?`, true))) return false;
      const nueva = await subirPelicula(accion.local, accion.entrada.id, ctx, accion.entrada.titulo);
      catalogo.splice(catalogo.indexOf(accion.entrada), 1, nueva);
      // El catálogo ya apunta a la nueva: la vieja sobra. Se guarda ANTES de
      // borrar, para que la app nunca apunte a una carpeta que ya no existe.
      await nube.escribirCatalogo(catalogo);
      if (vieja && vieja !== nueva.carpeta) await nube.borrarCarpeta(`peliculas/${vieja}`);
      decir("bien", `«${nueva.titulo}» reemplazada.`);
      return true;
    }
    case "huerfana": {
      const si = await preguntar(`«${accion.entrada.titulo}» ya no está en la carpeta. ¿La BORRO de la nube? Se dejará de ver en todos los aparatos.`, false);
      if (!si) {
        // Lo normal al decir que no: borraste el archivo para liberar disco y
        // la quieres seguir viendo. Se apunta para no preguntar cada vez.
        if (await preguntar(`¿Que «${accion.entrada.titulo}» se quede en la nube sin volver a preguntarte?`, true)) {
          accion.entrada.soloNube = true;
          decir("info", `«${accion.entrada.titulo}» se queda en la nube. Si vuelves a ponerla en la carpeta, se sincroniza como siempre.`);
          return true;
        }
        decir("info", `«${accion.entrada.titulo}» se queda en la nube.`);
        return false;
      }
      catalogo.splice(catalogo.indexOf(accion.entrada), 1);
      await nube.escribirCatalogo(catalogo);
      const carpeta = carpetaDe(accion.entrada);
      if (carpeta) await nube.borrarCarpeta(`peliculas/${carpeta}`);
      decir("bien", `«${accion.entrada.titulo}» borrada de la nube.`);
      return true;
    }
    case "basura": {
      if (!(await preguntar(`¿Borro la carpeta suelta peliculas/${accion.carpeta}? No la usa ninguna película.`, false))) return false;
      await nube.borrarCarpeta(`peliculas/${accion.carpeta}`);
      decir("bien", `peliculas/${accion.carpeta} borrada.`);
      return "sin-catalogo";
    }
    default:
      return false;
  }
}

function origenDe(local) {
  return { archivo: local.video.nombre, tamano: local.video.tamano, huella: local.video.huella, titulo: local.titulo };
}

/** De una URL pública a su ruta en el bucket. */
function rutaDeUrl(url) {
  const m = /\/(peliculas\/.+)$/.exec(url ?? "");
  return m ? m[1] : null;
}

// ── Subtítulos sueltos ───────────────────────────────────────────────────────

async function actualizarSubtitulos(accion, { nube, ejecutar, trabajo, decir }) {
  const { entrada } = accion;
  entrada.subtitulos ??= [];
  for (const { local, sub } of accion.adoptarSubs ?? []) {
    sub.origen = { archivo: local.nombre, huella: local.huella };
  }
  const carpeta = carpetaDe(entrada);
  if (!carpeta) throw new Error("No sé en qué carpeta de la nube está la película.");
  const temporal = join(trabajo, `subs-${entrada.id}`);
  await mkdir(temporal, { recursive: true });
  try {
    for (const s of accion.nuevos) {
      const nombre = `ext-${s.huella.slice(0, 10)}.vtt`;
      const destino = join(temporal, nombre);
      await convertirSubtitulo(s.ruta, destino, ejecutar);
      await nube.subirArchivo(destino, `peliculas/${carpeta}/${nombre}`, "text/vtt; charset=utf-8");
      entrada.subtitulos.push({
        label: s.etiqueta,
        srclang: s.srclang,
        url: nube.urlPublica(`peliculas/${carpeta}/${nombre}`),
        origen: { archivo: s.nombre, huella: s.huella },
      });
      decir("info", `   + ${s.etiqueta} (${s.nombre})`);
    }
  } finally {
    await rm(temporal, { recursive: true, force: true });
  }
  for (const viejo of accion.quitar) {
    entrada.subtitulos = entrada.subtitulos.filter((x) => x !== viejo);
    const ruta = rutaDeUrl(viejo.url);
    if (ruta) await nube.borrarArchivo(ruta);
    decir("info", `   − ${viejo.label} (ya no está en la carpeta)`);
  }
}

/** .srt/.ass/.vtt → .vtt. Un .srt descargado suele venir en Windows-1252: se le dice a ffmpeg. */
export async function convertirSubtitulo(origen, destino, ejecutar) {
  const codificacion = esUtf8(await readFile(origen)) ? [] : ["-sub_charenc", "CP1252"];
  const res = await ejecutar("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...codificacion, "-i", origen, "-c:s", "webvtt", destino]);
  if (res.codigo !== 0) throw new Error(`No pude convertir el subtítulo ${origen}: ${res.error?.trim() ?? ""}`);
}

// ── Subir una película ───────────────────────────────────────────────────────

async function subirPelicula(local, id, { nube, ejecutar, trabajo, decir, op }, tituloFijo) {
  // Espacio en el disco del PC: la conversión ocupa, como mucho, lo que el
  // original (copiando) o bastante menos (recodificando).
  try {
    const libre = await statfs(trabajo).then((s) => s.bavail * s.bsize);
    if (libre < local.video.tamano * 1.1) {
      throw new Error(`No hay sitio en el disco para convertirla: faltan ${gb(local.video.tamano * 1.1 - libre)}. Libera espacio y vuelve a sincronizar.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("No hay sitio")) throw error;
    // `statfs` no está en todos los sistemas: se sigue sin la comprobación.
  }

  const carpeta = `${id}-${local.video.huella.slice(0, 6)}`;
  const salida = join(trabajo, carpeta);
  await rm(salida, { recursive: true, force: true });
  await mkdir(salida, { recursive: true });
  try {
    decir("titulo", `Convirtiendo «${local.titulo}»`);
    const sonda = await ejecutar("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", "--", local.video.ruta]);
    if (sonda.codigo !== 0) throw new Error(`ffprobe no pudo leer ${local.video.nombre}`);
    const analisis = analizar(JSON.parse(sonda.salida), { audioPrincipal: op.audio });
    decir("info", `   Vídeo ${analisis.video.codec_name} ${analisis.video.width}×${analisis.video.height}, ${analisis.audios.length} audio(s)`);

    const funciona = (nombre) => op.probarCodificador?.(nombre) ?? false;
    const modos = modosAProbar(analisis, { aceleracion: op.aceleracion, recodificar: op.recodificar, funciona });
    if (modos[0] === "copiar") decir("info", "   Ya es compatible: se copia sin recodificar (rápido).");
    else decir("info", `   Hay que recodificar (${analisis.motivos.join(", ") || "pedido"}) con ${modos[0]}.`);
    const filtros = filtrosDeVideo(analisis, { hayZscale: op.hayZscale ?? true });

    let convertido = false;
    for (const modo of modos) {
      await rm(salida, { recursive: true, force: true });
      await mkdir(salida, { recursive: true });
      const args = ["-hide_banner", "-loglevel", "error", "-stats", "-y", "-i", local.video.ruta, ...argumentosHls(analisis, argumentosVideo(modo, { calidad: op.calidad, filtros }))];
      const res = await ejecutar("ffmpeg", args, { cwd: salida, mostrar: true });
      if (res.codigo === 0) {
        convertido = true;
        break;
      }
      decir("aviso", `   Falló con «${modo}»${modos.length > 1 ? "; pruebo el siguiente" : ""}.`);
    }
    if (!convertido) throw new Error("No se pudo convertir. Copia lo que salió en rojo y pásamelo.");

    const rutaMaestra = join(salida, "master.m3u8");
    await writeFile(rutaMaestra, maestraConNombres(await readFile(rutaMaestra, "utf8"), analisis), "utf8");

    // Subtítulos: los de dentro (por idioma) y los sueltos de la carpeta.
    const subtitulos = [];
    const { elegidos, imagenes } = subtitulosInternos(analisis, op.idiomasSubs);
    if (imagenes > 0) decir("aviso", `   ${imagenes} subtítulo(s) son imágenes (PGS/VobSub): no se pueden pasar a texto.`);
    for (const [n, s] of elegidos.entries()) {
      const nombre = `int${n}-${s.idioma}.vtt`;
      const res = await ejecutar("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", local.video.ruta, "-map", `0:${s.index}`, "-c:s", "webvtt", join(salida, nombre)]);
      if (res.codigo === 0) subtitulos.push({ label: s.etiqueta, srclang: s.srclang, archivo: nombre });
      else decir("aviso", `   Se omite el subtítulo interno «${s.etiqueta}».`);
    }
    for (const s of local.subtitulos) {
      const nombre = `ext-${s.huella.slice(0, 10)}.vtt`;
      try {
        await convertirSubtitulo(s.ruta, join(salida, nombre), ejecutar);
        subtitulos.push({ label: s.etiqueta, srclang: s.srclang, archivo: nombre, origen: { archivo: s.nombre, huella: s.huella } });
      } catch (error) {
        decir("aviso", `   ${error instanceof Error ? error.message : error}`);
      }
    }
    decir("info", `   Subtítulos: ${subtitulos.map((s) => s.label).join(", ") || "ninguno"}`);
    decir("info", `   Listo en disco: ${gb(await tamanoDe(salida))}`);

    decir("titulo", `Subiendo «${local.titulo}» a peliculas/${carpeta}`);
    await nube.subirCarpeta(salida, `peliculas/${carpeta}`);

    return {
      id,
      titulo: tituloFijo ?? local.titulo,
      url: nube.urlPublica(`peliculas/${carpeta}/master.m3u8`),
      carpeta,
      subtitulos: subtitulos.map(({ archivo, ...s }) => ({ ...s, url: nube.urlPublica(`peliculas/${carpeta}/${archivo}`) })),
      duracion: analisis.duracion,
      subida: new Date(op.ahora).toISOString(),
      origen: origenDe(local),
    };
  } finally {
    // La copia de trabajo pueden ser varios GB: fuera siempre, haya ido bien o mal.
    await rm(salida, { recursive: true, force: true });
  }
}

async function tamanoDe(carpeta) {
  let total = 0;
  for (const e of await readdir(carpeta, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) total += (await stat(join(e.parentPath ?? e.path, e.name))).size;
  }
  return total;
}

function gb(bytes) {
  return `${(bytes / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
}
