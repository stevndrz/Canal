/**
 * El plan: qué hay que hacer para que la nube quede como la carpeta.
 *
 * Es lo que convierte «subir, renombrar, borrar, añadir subtítulos» en una
 * sola cosa: dejar las películas en la carpeta y sincronizar. Puro —recibe
 * lo leído y devuelve una lista de acciones— para poder probarlo entero sin
 * nube ni ffmpeg, y para enseñarlo antes de hacer nada (`--mirar`).
 *
 * Cada entrada del catálogo guarda de dónde salió (`origen`: archivo, tamaño,
 * huella y el título que se le dedujo). Con eso:
 *
 *   - misma huella               → es la misma película, aunque se renombre;
 *   - mismo id, otra huella      → la reemplazaste por otra versión;
 *   - subtítulos por su huella   → se suben los nuevos y se quitan los que
 *                                  borraste de la carpeta (solo los que subió
 *                                  esta herramienta desde un archivo suelto;
 *                                  los que venían dentro del vídeo, nunca);
 *   - en el catálogo y no aquí   → «huérfana»: se PREGUNTA antes de borrar
 *                                  (o se marca «solo en la nube» y ya no se
 *                                  pregunta más).
 *
 * Las entradas viejas, de antes de esta herramienta, no tienen `origen`: se
 * emparejan por id y se «adoptan» (se apunta su origen) sin volver a subirlas.
 */

export function planificar(locales, catalogo, { carpetasNube = [] } = {}) {
  const acciones = [];
  const usadas = new Set();
  const porHuella = new Map(catalogo.filter((e) => e.origen?.huella).map((e) => [e.origen.huella, e]));
  const porId = new Map(catalogo.map((e) => [e.id, e]));

  for (const local of locales) {
    let entrada = porHuella.get(local.video.huella);
    let tipo;
    if (entrada && !usadas.has(entrada.id)) {
      tipo = "igual";
    } else {
      entrada = porId.get(local.id);
      if (entrada && usadas.has(entrada.id)) entrada = undefined;
      if (!entrada) tipo = "subir";
      else if (!entrada.origen) tipo = "adoptar";
      else tipo = "reemplazar";
    }

    if (tipo === "subir") {
      acciones.push({ tipo, local, id: idLibre(local.id, porId, usadas) });
      continue;
    }
    usadas.add(entrada.id);
    if (tipo === "reemplazar") {
      acciones.push({ tipo, local, entrada });
      continue;
    }
    if (tipo === "adoptar") acciones.push({ tipo, local, entrada });

    // Se renombró el archivo o su carpeta: cambia el título que se ve, no
    // la película. Solo si el título actual es el que se dedujo al subirla
    // (si alguien lo puso a mano, se respeta).
    if (entrada.origen && entrada.origen.titulo !== local.titulo && entrada.titulo === entrada.origen.titulo) {
      acciones.push({ tipo: "renombrar", local, entrada, titulo: local.titulo });
    }

    const subidos = (entrada.subtitulos ?? []).filter((s) => s.origen?.huella);
    const huellasSubidas = new Set(subidos.map((s) => s.origen.huella));
    const huellasLocales = new Set(local.subtitulos.map((s) => s.huella));
    let nuevos = local.subtitulos.filter((s) => !huellasSubidas.has(s.huella));
    const quitar = subidos.filter((s) => !huellasLocales.has(s.origen.huella));

    // Los subidos con el script viejo no tienen huella. Si en la carpeta hay
    // uno del mismo idioma (y forzado o no igual), es ese: se le apunta el
    // origen en vez de subirlo otra vez, que saldría duplicado en el selector.
    const sinOrigen = (entrada.subtitulos ?? []).filter((s) => !s.origen);
    const adoptarSubs = [];
    for (const s of [...nuevos]) {
      const forzado = (x) => /forz|forced/i.test(x);
      const par = sinOrigen.find((v) => v.srclang === s.srclang && forzado(v.label) === s.forzados && !adoptarSubs.some((a) => a.sub === v));
      if (par) {
        adoptarSubs.push({ local: s, sub: par });
        nuevos = nuevos.filter((n) => n !== s);
      }
    }
    if (nuevos.length || quitar.length || adoptarSubs.length) {
      acciones.push({ tipo: "subtitulos", local, entrada, nuevos, quitar, adoptarSubs });
    }
  }

  for (const entrada of catalogo) {
    // `soloNube`: se dijo que se quede en la nube aunque se borre del PC (para
    // liberar disco). No se vuelve a preguntar.
    if (!usadas.has(entrada.id) && !entrada.soloNube) acciones.push({ tipo: "huerfana", entrada });
  }

  // Carpetas en la nube que ninguna entrada usa: restos de una subida que se
  // cortó. Ocupan espacio de los 10 GB gratis.
  const enUso = new Set(catalogo.map((e) => carpetaDe(e)).filter(Boolean));
  for (const carpeta of carpetasNube) if (!enUso.has(carpeta)) acciones.push({ tipo: "basura", carpeta });

  return acciones;
}

/** La carpeta de la nube de una entrada, sacada de su URL («…/peliculas/<carpeta>/master.m3u8»). */
export function carpetaDe(entrada) {
  if (entrada.carpeta) return entrada.carpeta;
  const m = /\/peliculas\/([^/]+)\/[^/]+$/.exec(entrada.url ?? "");
  return m ? m[1] : null;
}

/** «coco» si está libre; si no, «coco-2», «coco-3»… */
function idLibre(id, porId, usadas) {
  if (!porId.has(id) && !usadas.has(id)) {
    usadas.add(id);
    return id;
  }
  let n = 2;
  while (porId.has(`${id}-${n}`) || usadas.has(`${id}-${n}`)) n++;
  usadas.add(`${id}-${n}`);
  return `${id}-${n}`;
}

/** El plan en palabras, para enseñarlo antes de hacer nada. */
export function describir(accion) {
  switch (accion.tipo) {
    case "subir":
      return `Subir «${accion.local.titulo}» (${gb(accion.local.video.tamano)}${accion.local.subtitulos.length ? `, ${accion.local.subtitulos.length} subtítulo(s)` : ""})`;
    case "reemplazar":
      return `Reemplazar «${accion.entrada.titulo}» por el archivo nuevo (${accion.local.video.nombre})`;
    case "adoptar":
      return `Reconocer «${accion.entrada.titulo}» (ya estaba subida; no se vuelve a subir)`;
    case "renombrar":
      return `Renombrar «${accion.entrada.titulo}» → «${accion.titulo}»`;
    case "subtitulos": {
      const partes = [];
      if (accion.nuevos.length) partes.push(`+ ${accion.nuevos.map((s) => s.etiqueta).join(", ")}`);
      if (accion.quitar.length) partes.push(`− ${accion.quitar.map((s) => s.label).join(", ")}`);
      if (accion.adoptarSubs?.length) partes.push(`ya subidos: ${accion.adoptarSubs.map((a) => a.sub.label).join(", ")}`);
      return `Subtítulos de «${accion.entrada.titulo}»: ${partes.join("  ")}`;
    }
    case "huerfana":
      return `«${accion.entrada.titulo}» está en la nube pero no en la carpeta`;
    case "basura":
      return `Carpeta suelta en la nube: peliculas/${accion.carpeta} (resto de una subida cortada)`;
    default:
      return accion.tipo;
  }
}

function gb(bytes) {
  return `${(bytes / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
}
