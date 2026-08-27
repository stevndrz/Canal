/**
 * Las dos cuentas que la guía EPG necesita en pantalla.
 *
 * Vivían copiadas al pie de la letra en `livetv/channel-row.tsx`,
 * `livetv/live-tv-view.tsx` y —con el reloj inyectado— en
 * `player/panel-emision.tsx`.
 */

/**
 * Cuánto lleva emitido el programa, de 0 a 100. `null` cuando no hay guía o el
 * tramo es absurdo (sin inicio, sin fin, o el fin antes del inicio).
 *
 * El reloj entra por argumento en vez de llamar aquí a `Date.now()`: así la
 * función es pura —comprobable, y sin romper `react-hooks/purity` en quien la
 * use durante el render.
 */
export function porcentajeDelPrograma(
  inicio: number | undefined,
  fin: number | undefined,
  ahora: number | undefined,
): number | null {
  if (!inicio || !fin || !ahora || fin <= inicio) return null;
  return Math.min(100, Math.max(0, ((ahora - inicio) / (fin - inicio)) * 100));
}

/** La hora de un instante, en el formato que se lee en Guatemala. */
export function hora(millis?: number): string {
  if (!millis) return "";
  return new Date(millis).toLocaleTimeString("es-GT", { hour: "numeric", minute: "2-digit" });
}
