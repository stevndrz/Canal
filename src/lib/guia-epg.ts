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

/**
 * Qué dan ahora en un canal, con lo que trae la lista: el programa actual y,
 * si ya terminó (la lista se arma cada pocos minutos y la página puede llevar
 * horas abierta), el siguiente si ya empezó. `null` si no se sabe o si el
 * instante aún no se conoce (`ahora` = 0, ver `useInstante`).
 */
export function queDanAhora(
  canal: { currentProgram?: string; currentStart?: number; currentEnd?: number; nextProgram?: string; nextStart?: number },
  ahora: number,
): { titulo: string; hasta?: number } | null {
  if (!ahora) return null;
  const { currentProgram, currentStart, currentEnd, nextProgram, nextStart } = canal;
  if (currentProgram && currentEnd && currentEnd > ahora && (!currentStart || currentStart <= ahora)) {
    return { titulo: currentProgram, hasta: currentEnd };
  }
  // Dos horas como mucho: después ya puede ir por otro programa.
  const reciente = nextStart && nextStart <= ahora && ahora - nextStart < 2 * 60 * 60_000;
  if (nextProgram && reciente && (!currentEnd || currentEnd <= ahora)) {
    // Del siguiente no se sabe cuándo acaba, y no se inventa.
    return { titulo: nextProgram };
  }
  return null;
}
