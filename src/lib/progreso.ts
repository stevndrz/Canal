/**
 * Por dónde iba cada cosa que se estaba viendo.
 *
 * **Solo funciona donde el `<video>` es nuestro**: «Mi enlace» y los servidores
 * «Directo». En los proveedores por iframe la posición no se puede leer —otro
 * dominio, la misma razón por la que tampoco se sabe si cargaron—, así que ahí
 * no se ofrece, en vez de dejar una barra que unos títulos tienen y otros no.
 *
 * Sin React ni `localStorage` para poder probarlo: `vitest` corre en `node`.
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
 * A partir de aquí se considera visto. Es **el mismo umbral que `MediaCard`**
 * usa para pintar la barra: con dos distintos habría una franja donde la
 * tarjeta no enseña progreso pero la fila sigue ofreciendo continuar.
 */
export const TERMINADO_PCT = 94;

/** Abrir una ficha y ver treinta segundos de anuncios no es «lo dejé a medias». */
export const MINIMO_PCT = 1;

/** Debajo de esto el porcentaje no significa nada: un clip corto, o un
 * `duration` que el navegador aún no sabe. En segundos. */
export const MINIMA_DURACION_S = 120;

/** Tope de títulos recordados. */
export const MAX_RECORDADOS = 200;

/** Cuánto se recuerda algo que nadie ha vuelto a tocar. */
export const OLVIDO_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * La clave de lo que se está viendo, a partir de la clave del título.
 *
 * `claveBase` es **la misma cadena que `CardItem.key`** —la que produce
 * `claveCatalogo()`, `"tv-tmdb-125988"`— y no el `tmdbId` a secas. Lo fue
 * durante un tiempo, y era un fallo silencioso: el reproductor guardaba en
 * `"tv-125988"` mientras la tarjeta preguntaba por `"tv-tmdb-125988"`, así que
 * la barra de progreso no salía nunca y «Seguir viendo» estaba siempre vacío
 * aunque `localStorage` tuviera entradas. Derivarla de la clave del título en
 * vez de reconstruirla hace que no puedan volver a separarse.
 *
 * Un episodio se recuerda aparte: quien va por el cuatro no quiere volver al
 * tres.
 */
export function claveDeTitulo(
  claveBase: string,
  season?: number,
  episode?: number,
): string {
  if (season !== undefined && episode !== undefined) {
    return `${claveBase}-t${season}e${episode}`;
  }
  return claveBase;
}

/**
 * La clave del título a partir de la de un episodio suyo, o la misma cadena si
 * ya era la de un título. Es la vuelta de `claveDeTitulo`: la fila de
 * «Continuar viendo» guarda episodios y necesita saber de qué serie son.
 */
export function claveSinEpisodio(clave: string): string {
  return clave.replace(/-t\d+e\d+$/, "");
}

/** La temporada y el episodio escondidos en una clave, si los lleva. */
export function episodioDeClave(clave: string): { temporada: number; episodio: number } | null {
  const partes = /-t(\d+)e(\d+)$/.exec(clave);
  if (!partes) return null;
  return { temporada: Number(partes[1]), episodio: Number(partes[2]) };
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

/** Ni lo apenas empezado, ni lo acabado, ni lo que dura demasiado poco. */
export function valeLaPena(marca: Marca): boolean {
  if (marca.duracion < MINIMA_DURACION_S) return false;
  const pct = porcentaje(marca);
  return pct >= MINIMO_PCT && pct < TERMINADO_PCT;
}

/**
 * Guarda por dónde iba, o **borra la entrada** si ya no vale la pena. Que
 * terminar borre en vez de guardar un 100 es lo que mantiene la fila sola: si
 * no, sería la lista de todo lo visto alguna vez.
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
 * El segundo por el que retomar. `undefined` y no `0` a propósito: quien llama
 * tiene que distinguir «empieza por el principio» de «no hay nada guardado».
 */
export function posicionGuardada(
  memoria: MemoriaProgreso,
  clave: string,
): number | undefined {
  const marca = memoria[clave];
  if (!marca || !valeLaPena(marca)) return undefined;
  return marca.posicion;
}

/** Lo empezado, de lo más reciente a lo más viejo: el orden de la fila. */
export function enOrden(memoria: MemoriaProgreso): { clave: string; marca: Marca }[] {
  return Object.entries(memoria)
    .filter(([, marca]) => valeLaPena(marca))
    .sort((a, b) => b[1].visto - a[1].visto)
    .map(([clave, marca]) => ({ clave, marca }));
}

/**
 * Primero lo caducado, que es gratis; si aún no cabe, lo que lleva más tiempo
 * sin tocarse. Mismo criterio que `canales-caidos.ts`.
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
