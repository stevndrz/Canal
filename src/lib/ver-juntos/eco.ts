/**
 * ¿Lo que acaba de contar el `<video>` es lo que le mandamos hacer?
 *
 * Cuando la sala mueve el vídeo local (salto, play o pausa), el `<video>`
 * avisa con sus eventos igual que si lo hubiera tocado la persona. Esos avisos
 * son **eco** y no se reenvían: si se reenviaran, el otro aparato recibiría su
 * propio estado con retraso y saltaría hacia atrás.
 *
 * Antes se decidía solo por tiempo: un segundo de silencio tras cada orden. En
 * un iPhone (HLS nativo) o en una tele, un salto puede tardar dos o tres
 * segundos en terminar; su `seeked` llegaba fuera de la ventana, se reenviaba
 * como si fuera de la persona, y el anfitrión retrocedía lo que había tardado
 * el salto. Cada cinco segundos, con cada pulso: «no se sincroniza».
 *
 * Ahora se compara con lo que se esperaba: si el vídeo está como se le pidió
 * —mismo play/pausa y el tiempo donde debía, contando lo que haya avanzado
 * desde entonces—, es eco, tarde lo que tarde (con un tope). Si la persona
 * pausa o salta a otro sitio mientras tanto, el estado ya no cuadra y sí se
 * manda. (Un salto suyo al mismo sitio, o con el mismo play/pausa en esos
 * segundos, se toma por eco: no pasa nada, el pulso siguiente lo iguala.)
 */

export interface Esperado {
  tiempo: number;
  pausado: boolean;
  /** `Date.now()` del momento en que se aplicó. */
  desde: number;
}

/** Pasado esto, nada se toma por eco: el salto más lento medido no llega. */
export const ECO_MAXIMO_MS = 10_000;

export function esEco(
  esperado: Esperado | null,
  actual: { tiempo: number; pausado: boolean },
  ahora: number,
  tolerancia: number,
  evento: "play" | "pause" | "seeked",
): boolean {
  if (!esperado) return false;
  const pasado = ahora - esperado.desde;
  if (pasado < 0 || pasado > ECO_MAXIMO_MS) return false;
  if (actual.pausado !== esperado.pausado) return false;
  // Un play o una pausa que deja el vídeo como se pidió es la orden cumplida,
  // aunque el salto que iba con ella no haya terminado todavía (su tiempo
  // aún es el viejo). Solo un salto tiene que caer donde se pidió.
  if (evento !== "seeked") return true;
  // Si se pidió reproducir, el vídeo ha podido avanzar como mucho lo que ha
  // pasado desde entonces (menos, si tardó en arrancar).
  const avance = esperado.pausado ? 0 : pasado / 1000;
  return actual.tiempo >= esperado.tiempo - tolerancia && actual.tiempo <= esperado.tiempo + avance + tolerancia;
}

/**
 * Un pulso que llega justo después de que la persona toque algo es viejo.
 *
 * Quien dirige cuenta cada cinco segundos por dónde va («voy por 12:34,
 * reproduciendo»). Si ese pulso salió antes de que le llegara la pausa de otro
 * aparato, a ese aparato le llega DESPUÉS de haber pausado, y obedecerlo era
 * volver a arrancar: la película seguía sola hasta el pulso siguiente. Y si
 * llegaba en el mismo instante —antes incluso de que el `<video>` avisara de
 * su pausa—, la pausa se tomaba por eco y no se mandaba a nadie: «pulsé pausa
 * y no pasó nada».
 *
 * Dos defensas, y hacen falta las dos:
 * - un pulso no se aplica al momento, sino un instante después
 *   (`ESPERA_PULSO_MS`): le da tiempo al `<video>` a contar lo que la persona
 *   acaba de hacer;
 * - y si para entonces este aparato mandó algo suyo hace menos de
 *   `TRAS_ACCION_MS`, el pulso se descarta: el siguiente ya traerá la respuesta
 *   de quien dirige a esa acción.
 *
 * Solo los pulsos: un play, una pausa o un salto de otra persona se obedecen
 * siempre y al momento.
 */
export const ESPERA_PULSO_MS = 150;
export const TRAS_ACCION_MS = 1500;

export function pulsoVigente(ahora: number, ultimaAccionLocal: number): boolean {
  return ahora - ultimaAccionLocal >= TRAS_ACCION_MS;
}
