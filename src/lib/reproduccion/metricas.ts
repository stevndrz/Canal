import { track } from "@vercel/analytics";

/**
 * Telemetría de reproducción real, para dejar de adivinar rendimiento por
 * lectura de código. Sale por Vercel Analytics porque la app ya vive en
 * Vercel: cero infraestructura nueva que mantener.
 *
 * Solo tres eventos — arranque, atasco, fallo — porque son los tres que de
 * verdad separan "el reproductor va bien" de "el reproductor va mal" para
 * quien mira el panel. Cambios de calidad de hls.js quedan fuera a propósito:
 * en una lista IPTV con conexión floja son constantes, y contarlos todos
 * ahogaría el panel sin añadir nada que "hubo un atajo" ya no diga.
 */

export type MotorMedido = "hls" | "mpegts" | "flv" | "native";
export type ContextoMedido = "canal" | "pelicula";

/** Ruido, no señal: un `waiting` de menos de esto es el hueco normal entre segmentos. */
const UMBRAL_ATASCO_MS = 300;

export function marcarInicio(): number {
  return performance.now();
}

export function registrarArranque(desde: number, motor: MotorMedido, contexto: ContextoMedido): void {
  track("reproduccion_arranque", { motor, contexto, ms: Math.round(performance.now() - desde) });
}

export function registrarAtasco(desde: number, motor: MotorMedido, contexto: ContextoMedido): void {
  const ms = Math.round(performance.now() - desde);
  if (ms < UMBRAL_ATASCO_MS) return;
  track("reproduccion_atasco", { motor, contexto, ms });
}

export function registrarFallo(motor: MotorMedido, contexto: ContextoMedido): void {
  track("reproduccion_fallo", { motor, contexto });
}
