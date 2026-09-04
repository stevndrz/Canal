/**
 * Puntuación de una sonda de emisión, sin red ni React, para poder probarla.
 *
 * La sonda real vive en `/api/salud`: descarga los primeros bytes de la URL y
 * mide cuánto tarda. Aquí solo vive la aritmética que convierte esa lectura en
 * un número comparable entre canales.
 */

/** Lo que mide `/api/salud` de una URL. */
export interface LecturaSonda {
  ok: boolean;
  /** Tiempo hasta la primera respuesta, en ms. */
  ttffMs?: number;
  /** El cuerpo parecía una lista HLS (`#EXTM3U`). */
  esM3u8?: boolean;
}

/**
 * 0–100. Sin respuesta no hay puntos; responder rápido y con manifiesto suma.
 * Los umbrales son de zapeo real: por debajo de 1 s se siente instantáneo, por
 * encima de 8 s la gente ya pulsó otro canal.
 */
export function puntuarSonda(lectura: LecturaSonda): number {
  if (!lectura.ok) return 0;
  const ttff = lectura.ttffMs ?? 8000;
  let puntos = 40;
  if (ttff < 1000) puntos += 40;
  else if (ttff < 3000) puntos += 30;
  else if (ttff < 8000) puntos += 15;
  if (lectura.esM3u8) puntos += 10;
  return Math.min(100, puntos);
}

export type EstadoSonda = "buena" | "regular" | "mala";

export function clasificarSonda(puntos: number): EstadoSonda {
  if (puntos >= 70) return "buena";
  if (puntos >= 40) return "regular";
  return "mala";
}
