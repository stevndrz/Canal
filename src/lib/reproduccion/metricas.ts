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

/**
 * Lo que falla en una sala de «Ver juntos», para verlo sin estar delante.
 *
 * Los registros de Vercel duran una hora y, además, casi nada de esto pasa por
 * el servidor: el play y la pausa viajan de aparato a aparato. Lo único que
 * sabe que «a ella no le arrancó» es su teléfono, así que lo cuenta él.
 *
 * - `sala_no_arranco`: el navegador no dejó reproducir sin un toque (ni en
 *   silencio). La persona ve «Toca para unirte a la sala».
 * - `sala_sin_sonido`: arrancó, pero mudo, hasta que toque.
 * - `sala_desincronia`: el pulso de quien dirige tuvo que mover este vídeo
 *   más de lo tolerado. `s` son los segundos de diferencia.
 * - `sala_corte`: hubo que rehacer la conexión (`motivo`: volver de segundo
 *   plano, o un error de la conexión).
 * - `sala_sin_conexion`: no se pudo entrar en la sala.
 *
 * **Sin datos de nadie**: ni el código de la sala, ni el alias, ni el título.
 */
export type FalloDeSala = "no_arranco" | "sin_sonido" | "desincronia" | "corte" | "sin_conexion";

/** Un mismo fallo, como mucho una vez cada tanto: un wifi malo no debe mandar cien eventos. */
const ENTRE_IGUALES_MS = 30_000;
/** Y un tope por visita, por si algo entra en bucle. */
const MAX_POR_VISITA = 40;

/**
 * Decide si un evento se manda. Aparte de `registrarSala` para poder probarlo
 * sin navegador ni reloj.
 */
export function crearFreno(entreIgualesMs = ENTRE_IGUALES_MS, maximo = MAX_POR_VISITA) {
  const ultimo = new Map<string, number>();
  let enviados = 0;
  return (clave: string, ahora: number): boolean => {
    if (enviados >= maximo) return false;
    const antes = ultimo.get(clave);
    if (antes !== undefined && ahora - antes < entreIgualesMs) return false;
    ultimo.set(clave, ahora);
    enviados += 1;
    return true;
  };
}

const frenoSala = crearFreno();

export function registrarSala(que: FalloDeSala, datos: Record<string, string | number> = {}): void {
  if (!frenoSala(que, Date.now())) return;
  try {
    track(`sala_${que}`, datos);
  } catch {
    // Medir nunca puede romper la película.
  }
}
