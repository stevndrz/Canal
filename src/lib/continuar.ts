/**
 * Qué se estaba viendo, y por dónde va.
 *
 * Existe porque `progreso.ts` **no puede cubrir el caso normal de esta app**:
 * ahí la posición se lee del `<video>`, y el `<video>` solo es nuestro con «Mi
 * enlace» y los servidores «Directo». Lo que la gente usa a diario son los
 * proveedores por iframe (VidSrc, VidAPI…), otro dominio: ni posición ni
 * duración ni evento de fin. Con solo `progreso.ts`, «Seguir viendo» estaba
 * vacío para casi todo el catálogo, y la queja era exactamente esa — estar
 * viendo una serie y que Inicio no se enterara.
 *
 * Lo que sí se sabe siempre, venga de donde venga el vídeo, es **qué se abrió
 * y qué episodio se eligió**. Eso es lo que se guarda aquí. Es una señal más
 * pobre que un porcentaje, y a cambio funciona en todos los proveedores en vez
 * de en uno.
 *
 * Guarda también título y carátula. Es deliberado, y es lo que separa esta
 * fila de la que hacía `seguirViendo()` en `media-item.ts`: aquella solo podía
 * ofrecer lo que ya viniera en las filas curadas del servidor, así que una
 * serie encontrada por el buscador desaparecía de «Seguir viendo» en cuanto
 * salías de la ficha. Con la carátula guardada, la fila se pinta sin pedirle
 * nada a TMDB y sirve para cualquier título.
 *
 * Sin React ni `localStorage` para poder probarlo: `vitest` corre en `node`.
 */

/** Un título empezado, con lo justo para volver a pintarlo y volver a abrirlo. */
export interface EnCurso {
  /** La clave de la tarjeta (`"tv-tmdb-125988"`). Ver `claveCatalogo`. */
  clave: string;
  mediaType: "movie" | "tv";
  /** El id tal cual va en la URL de la ficha (`"tmdb-125988"`). */
  id: string;
  titulo: string;
  poster: string | null;
  backdrop: string | null;
  /** Series: el episodio en el que se quedó. */
  temporada?: number;
  episodio?: number;
  tituloEpisodio?: string;
  /**
   * El porcentaje, cuando se puede saber (reproductor propio). `undefined` en
   * los iframes, que es lo normal: la tarjeta simplemente no pinta barra.
   */
  porcentaje?: number;
  /** Cuándo fue la última vez. Ordena la fila y guía la poda. */
  visto: number;
}

export type MemoriaEnCurso = Record<string, EnCurso>;

/**
 * Tope de títulos en la fila. Bastante más bajo que el de `progreso.ts` (200):
 * aquí cada entrada guarda título y dos URLs de carátula, y esto es una fila
 * que se recorre con el dedo o con un mando, no un archivo histórico.
 */
export const MAX_EN_CURSO = 24;

/** Cuánto se recuerda algo que nadie ha vuelto a abrir. */
export const OLVIDO_EN_CURSO_MS = 120 * 24 * 60 * 60 * 1000;

/**
 * Anota que se está viendo esto.
 *
 * Una entrada por título, **no por episodio**: quien va por el cuarto capítulo
 * quiere una tarjeta que diga «T1 E4», no cuatro tarjetas de la misma serie
 * llenando la fila. El episodio se sobreescribe; la serie se queda.
 */
export function anotar(memoria: MemoriaEnCurso, entrada: EnCurso): MemoriaEnCurso {
  const previa = memoria[entrada.clave];
  // Reabrir la ficha sin tocar nada no debería reordenar la fila entera: si no
  // cambia ni el episodio ni el porcentaje, se devuelve el mismo objeto y
  // nadie repinta. Mismo criterio que `marcar` en `progreso.ts`.
  if (
    previa &&
    previa.temporada === entrada.temporada &&
    previa.episodio === entrada.episodio &&
    previa.porcentaje === entrada.porcentaje
  ) {
    return memoria;
  }
  return podarEnCurso({ ...memoria, [entrada.clave]: entrada }, entrada.visto);
}

/** Quitar algo de la fila a mano. Lo que se quita no vuelve. */
export function olvidarEnCurso(memoria: MemoriaEnCurso, clave: string): MemoriaEnCurso {
  if (!(clave in memoria)) return memoria;
  const siguiente = { ...memoria };
  delete siguiente[clave];
  return siguiente;
}

/** Lo empezado, de lo más reciente a lo más viejo: el orden de la fila. */
export function enCursoOrdenado(memoria: MemoriaEnCurso): EnCurso[] {
  return Object.values(memoria).sort((a, b) => b.visto - a.visto);
}

/**
 * Primero lo caducado, que es gratis; si aún no cabe, lo que lleva más tiempo
 * sin abrirse. Mismo criterio que `progreso.ts` y que `canales-caidos.ts`.
 */
export function podarEnCurso(memoria: MemoriaEnCurso, ahora: number): MemoriaEnCurso {
  const vivas = Object.entries(memoria).filter(
    ([, entrada]) => ahora - entrada.visto <= OLVIDO_EN_CURSO_MS,
  );
  if (vivas.length <= MAX_EN_CURSO) {
    return vivas.length === Object.keys(memoria).length ? memoria : Object.fromEntries(vivas);
  }
  const recientes = vivas.sort((a, b) => b[1].visto - a[1].visto).slice(0, MAX_EN_CURSO);
  return Object.fromEntries(recientes);
}

/**
 * La línea de debajo de la tarjeta: «T1 E4 · Título del capítulo», o el tipo a
 * secas en una película. Es lo único que distingue esta fila de las demás — sin
 * ella, una serie a medias se ve igual que una recomendación cualquiera.
 */
export function resumen(entrada: EnCurso): string {
  if (entrada.mediaType !== "tv" || entrada.temporada === undefined) return "Película";
  const codigo = `T${entrada.temporada} E${entrada.episodio ?? 1}`;
  return entrada.tituloEpisodio ? `${codigo} · ${entrada.tituloEpisodio}` : codigo;
}
