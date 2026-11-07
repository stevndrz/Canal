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
