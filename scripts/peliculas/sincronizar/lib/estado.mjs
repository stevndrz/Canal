import { leerBiblioteca } from "./biblioteca.mjs";
import { planificar } from "./plan.mjs";

/**
 * Lo que enseña el panel: una fila por película, juntando la carpeta del PC
 * y el catálogo de la nube, con lo que le pasaría al sincronizar.
 *
 *   al-dia      está en el PC y en la app, igual
 *   cambios     está en las dos, pero hay algo que subir (subtítulos, nombre…)
 *   por-subir   solo en el PC
 *   solo-nube   solo en la app (borrada del PC o subida desde otro sitio)
 *
 * Y aparte, lo que se salta (descargas a medias, copias repetidas).
 * Puro sobre lo leído: no toca la nube más que para leer.
 */
export async function estado({ raiz, nube, ahora = Date.now() }) {
  const { peliculas: locales, saltadas } = await leerBiblioteca(raiz, { ahora });
  const catalogo = await nube.leerCatalogo();
  const carpetasNube = await nube.listarCarpetas();
  const plan = planificar(locales, catalogo, { carpetasNube });
  return { ...filas(locales, catalogo, plan), saltadas, pendientes: plan.length, usado: await nube.tamanoTotal() };
}

/** Separado de `estado` para probarlo sin disco. */
export function filas(locales, catalogo, plan) {
  const porHuella = new Map(catalogo.filter((e) => e.origen?.huella).map((e) => [e.origen.huella, e]));
  const accionesDe = (local) => plan.filter((a) => a.local === local);
  const usadas = new Set();
  const lista = [];

  for (const local of locales) {
    const acciones = accionesDe(local);
    const conEntrada = acciones.find((a) => a.entrada);
    const entrada = conEntrada?.entrada ?? (acciones.some((a) => a.tipo === "subir") ? null : porHuella.get(local.video.huella) ?? null);
    if (entrada) usadas.add(entrada);
    const estadoFila = !entrada ? "por-subir" : acciones.length ? "cambios" : "al-dia";
    lista.push({
      clave: entrada ? `nube:${entrada.id}` : `pc:${local.id}`,
      id: entrada?.id ?? null,
      titulo: entrada?.titulo ?? local.titulo,
      anio: local.anio ?? null,
      estado: estadoFila,
      enPc: true,
      enNube: Boolean(entrada),
      tamano: local.video.tamano,
      archivo: local.video.ruta,
      subtitulos: (entrada?.subtitulos ?? []).map((s) => s.label),
      subtitulosPc: local.subtitulos.map((s) => s.etiqueta),
      cambios: acciones.map((a) => a.tipo),
    });
  }
  for (const entrada of catalogo) {
    if (usadas.has(entrada)) continue;
    lista.push({
      clave: `nube:${entrada.id}`,
      id: entrada.id,
      titulo: entrada.titulo,
      anio: null,
      estado: "solo-nube",
      enPc: false,
      enNube: true,
      tamano: null,
      archivo: null,
      subtitulos: (entrada.subtitulos ?? []).map((s) => s.label),
      subtitulosPc: [],
      cambios: entrada.soloNube ? [] : ["huerfana"],
    });
  }
  lista.sort((a, b) => a.titulo.localeCompare(b.titulo, "es"));
  return { peliculas: lista };
}
