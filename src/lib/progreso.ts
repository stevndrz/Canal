/**
 * Por dónde iba cada cosa que se estaba viendo.
 *
 * «Seguir viendo» existía en la portada desde el principio, pero era historial
 * y no reanudación: enseñaba lo último que se había abierto y al pulsar
 * empezaba de cero. La barra de progreso de la tarjeta también estaba escrita
 * —`CardItem.progress`, que `MediaCard` pinta cuando el valor está entre 1 y
 * 94— y **no la alimentaba nadie**. Esto es lo que faltaba en medio.
 *
 * **Dónde funciona y dónde no, que conviene decirlo por delante.** Solo puede
 * funcionar donde el `<video>` es nuestro: «Mi enlace» y los servidores
 * «Directo» de los addons. En los proveedores por iframe es imposible leer la
 * posición, por la misma razón estructural por la que tampoco se puede saber si
 * cargaron: es otro dominio. Así que la función se ofrece donde funciona y no
 * se insinúa donde no — nada de una barra a medias que unos títulos tienen y
 * otros no sin explicación.
 *
 * Aquí solo vive la lógica, sin React ni `localStorage`, para poder probarla:
 * `vitest.config.ts` usa `environment: "node"`.
 */

/** Lo que se recuerda de un título empezado. */
export interface Marca {
  /** Segundo por el que iba. */
  posicion: number;
  /** Duración total. Sin ella no hay porcentaje que pintar. */
  duracion: number;
  /** Cuándo se vio por última vez. Ordena la fila y guía la poda. */
  visto: number;
}

export type MemoriaProgreso = Record<string, Marca>;

/**
 * A partir de aquí se considera visto.
 *
 * 94 no es un número al azar: es **el mismo umbral que `MediaCard` ya usa**
 * para decidir si pinta la barra. Si fueran distintos habría una franja en la
 * que la tarjeta no enseña progreso pero la fila sigue ofreciendo continuar, y
 * eso se lee como un fallo. Un solo número para las dos decisiones.
 */
export const TERMINADO_PCT = 94;

/**
 * Por debajo de esto no se recuerda nada.
 *
 * Alguien abre una ficha, ve treinta segundos de anuncios y se va: eso no es
 * «lo dejé a medias», es «lo abrí». Ofrecerlo en Seguir viendo llenaría la fila
 * de cosas que nadie empezó de verdad.
 */
export const MINIMO_PCT = 1;

/**
 * Duración mínima para molestarse en recordar, en segundos.
 *
 * Protege del caso raro pero real: un enlace de dos minutos donde el 1% son
 * apenas unos segundos, o un `duration` que el navegador aún no sabe y reporta
 * como algo diminuto.
 */
export const MINIMA_DURACION_S = 120;

/** Tope de títulos recordados. */
export const MAX_RECORDADOS = 200;

/** Cuánto se recuerda algo que nadie ha vuelto a tocar. */
export const OLVIDO_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * La clave de un título del catálogo.
 *
 * Un episodio se recuerda por separado de su serie y de sus hermanos: quien va
 * por el capítulo cuatro no quiere que continuar le devuelva al tres.
 */
export function claveDeTitulo(
  mediaType: "movie" | "tv",
  id: number,
  season?: number,
  episode?: number,
): string {
  if (mediaType === "tv" && season !== undefined && episode !== undefined) {
    return `tv-${id}-t${season}e${episode}`;
  }
  return `${mediaType}-${id}`;
}

/** La clave de una fuente propia. Su `id` ya es único dentro de la lista. */
export function claveDeFuente(id: string): string {
  return `fuente-${id}`;
}

/** Cuánto se lleva visto, de 0 a 100. */
export function porcentaje(marca: Marca): number {
  if (!(marca.duracion > 0)) return 0;
  const bruto = (marca.posicion / marca.duracion) * 100;
  // Acotado por si un `currentTime` se pasa de `duration` al terminar.
  return Math.min(100, Math.max(0, Math.round(bruto)));
}

/** ¿Se puede dar por visto? */
export function estaTerminado(marca: Marca): boolean {
  return porcentaje(marca) >= TERMINADO_PCT;
}

/**
 * ¿Vale la pena recordar esta posición?
 *
 * Tres noes: lo que apenas se empezó, lo que ya se acabó, y lo que dura tan
 * poco que el porcentaje no significa nada.
 */
export function valeLaPena(marca: Marca): boolean {
  if (marca.duracion < MINIMA_DURACION_S) return false;
  const pct = porcentaje(marca);
  return pct >= MINIMO_PCT && pct < TERMINADO_PCT;
}

/**
 * Guarda por dónde iba, o **borra la entrada** si ya no vale la pena.
 *
 * Que terminar borre en vez de guardar un 100 es la parte que hace que la fila
 * se mantenga sola: sin eso, «Seguir viendo» acabaría siendo una lista de todo
 * lo que se ha visto alguna vez, que es justo lo que no se está pidiendo.
 */
export function marcar(
  memoria: MemoriaProgreso,
  clave: string,
  marca: Marca,
): MemoriaProgreso {
  if (!valeLaPena(marca)) {
    if (!(clave in memoria)) return memoria;
    const siguiente = { ...memoria };
    delete siguiente[clave];
    return siguiente;
  }
  return podar({ ...memoria, [clave]: marca }, marca.visto);
}

/** Olvida una entrada a mano: lo que se quita de la fila no vuelve. */
export function olvidar(memoria: MemoriaProgreso, clave: string): MemoriaProgreso {
  if (!(clave in memoria)) return memoria;
  const siguiente = { ...memoria };
  delete siguiente[clave];
  return siguiente;
}

/**
 * El segundo por el que retomar, o `undefined` para empezar de cero.
 *
 * Devuelve `undefined` y no `0` a propósito: quien llama tiene que poder
 * distinguir «empieza por el principio» de «no hay nada guardado», porque en un
 * caso hay que tocar `currentTime` y en el otro no.
 */
export function posicionGuardada(
  memoria: MemoriaProgreso,
  clave: string,
): number | undefined {
  const marca = memoria[clave];
  if (!marca || !valeLaPena(marca)) return undefined;
  return marca.posicion;
}

/**
 * Lo empezado, de lo más reciente a lo más viejo.
 *
 * El orden es el de la fila: lo último que se estaba viendo va primero, que es
 * lo que casi siempre se busca al encender.
 */
export function enOrden(memoria: MemoriaProgreso): { clave: string; marca: Marca }[] {
  return Object.entries(memoria)
    .filter(([, marca]) => valeLaPena(marca))
    .sort((a, b) => b[1].visto - a[1].visto)
    .map(([clave, marca]) => ({ clave, marca }));
}

/**
 * Quita lo viejo y lo que sobra del tope.
 *
 * Mismo criterio que `canales-caidos.ts`: primero lo caducado, que es gratis, y
 * si aún no cabe, lo que lleva más tiempo sin tocarse. `localStorage` en un
 * televisor no es infinito y esto crece con el uso.
 */
export function podar(memoria: MemoriaProgreso, ahora: number): MemoriaProgreso {
  const vivas = Object.entries(memoria).filter(
    ([, marca]) => ahora - marca.visto <= OLVIDO_MS,
  );
  if (vivas.length <= MAX_RECORDADOS) {
    return vivas.length === Object.keys(memoria).length
      ? memoria
      : Object.fromEntries(vivas);
  }
  const recientes = vivas.sort((a, b) => b[1].visto - a[1].visto).slice(0, MAX_RECORDADOS);
  return Object.fromEntries(recientes);
}
