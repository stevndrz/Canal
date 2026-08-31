/**
 * Las decisiones puras de dictar una búsqueda, fuera del hook por lo mismo que
 * `reproduccion/cast.ts` salió de `use-cast.ts`: se pueden probar sin
 * componente, sin permiso de micrófono y sin hablarle a un ordenador.
 *
 * **Por qué existe esto.** Hay un teclado en pantalla (`tv-keyboard.tsx`)
 * porque en un televisor sin teclado físico un campo de texto a secas es un
 * callejón sin salida: el mando solo mueve el foco, y escribir «guardianes de
 * la galaxia» son cuarenta y tantas pulsaciones. Dictarlo es una.
 *
 * **Y por qué no puede ser la única vía.** El reconocimiento de voz del
 * navegador no está en todas partes, y menos en el parque al que apunta esta
 * app: webOS y Tizen lo traen a ratos, con versiones de Chromium de hace años.
 * Así que esto es un atajo cuando lo hay, nunca un sustituto. La regla es la
 * misma que en `use-cast.ts`: **si no va a funcionar, el botón no existe** — en
 * vez de ofrecerlo y que no pase nada, que es lo que de verdad parece roto.
 */

/** Lo poco que se necesita del API del navegador para saber si se puede. */
export interface EntornoDeVoz {
  /** El constructor estándar, cuando existe. */
  SpeechRecognition?: unknown;
  /** El de WebKit, que es el que traen casi todos los que lo traen. */
  webkitSpeechRecognition?: unknown;
  /** `navigator.mediaDevices`, ausente fuera de un origen seguro. */
  mediaDevices?: unknown;
}

/**
 * El idioma que se le pide al reconocedor.
 *
 * `es-419` es el español de Latinoamérica, que es lo que se habla donde se usa
 * esto — y no da igual: con `es-ES` un reconocedor puede devolver «coger» donde
 * alguien dijo otra cosa, y sobre todo tropieza con los nombres propios y el
 * seseo. Si el navegador no conoce la etiqueta, cae solo a un español genérico.
 */
export const IDIOMA = "es-419";

/**
 * ¿Se puede dictar aquí?
 *
 * Las dos condiciones son necesarias y ninguna basta sola. El constructor puede
 * existir y el micrófono estar fuera de alcance —una página servida por `http:`
 * no tiene `mediaDevices`, y esta app se prueba en la red de casa— y entonces
 * el botón saldría para no hacer nada.
 */
export function hayDictado(entorno: EntornoDeVoz | undefined): boolean {
  if (!entorno) return false;
  const hayMotor = Boolean(entorno.SpeechRecognition ?? entorno.webkitSpeechRecognition);
  return hayMotor && Boolean(entorno.mediaDevices);
}

/** El constructor que toque, o nada. El estándar primero. */
export function motorDeDictado(entorno: EntornoDeVoz | undefined): unknown | null {
  if (!hayDictado(entorno)) return null;
  return entorno!.SpeechRecognition ?? entorno!.webkitSpeechRecognition ?? null;
}

/**
 * Deja lo dictado como algo que se pueda buscar.
 *
 * Los reconocedores devuelven una frase con mayúscula inicial y, muy a menudo,
 * un punto final: «Guardianes de la galaxia.» Ese punto no es un detalle
 * cosmético — se manda tal cual a TMDB y a la lista M3U, y en TMDB estropea la
 * coincidencia. Se quita la puntuación de los extremos y los espacios de más,
 * y no se toca nada de dentro: los nombres propios llevan puntos y guiones que
 * sí cuentan («Dr. Who», «Spider-Man»).
 */
export function limpiarDictado(texto: string): string {
  return texto
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.,;:¿?¡!]+/, "")
    .replace(/[.,;:]+$/, "")
    .trim();
}

/**
 * Qué decirle a quien está delante cuando el dictado falla.
 *
 * Los códigos del API son de los que no se pueden enseñar tal cual: `no-speech`
 * y `not-allowed` no significan nada desde el sofá. Y la diferencia entre «no
 * te oí» y «no me dejas oírte» importa, porque una se arregla repitiendo y la
 * otra hay que ir a los ajustes del navegador.
 */
export function mensajeDeError(codigo: string): string {
  switch (codigo) {
    case "not-allowed":
    case "service-not-allowed":
      return "El navegador no dio permiso para usar el micrófono. Se puede conceder desde sus ajustes.";
    case "no-speech":
      return "No se escuchó nada. Prueba otra vez, más cerca del micrófono.";
    case "audio-capture":
      return "No se encontró ningún micrófono en este aparato.";
    case "network":
      return "El reconocimiento de voz necesita conexión y no la hubo.";
    case "aborted":
      // Cancelar no es un error que merezca un aviso, igual que cerrar el
      // selector de pantallas en `cast.ts`.
      return "";
    default:
      return "No se pudo escuchar. Puedes escribirlo con el teclado.";
  }
}
