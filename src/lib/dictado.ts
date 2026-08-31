/**
 * Las decisiones puras de dictar una búsqueda, fuera del hook para poder
 * probarlas sin micrófono — el mismo motivo por el que `cast.ts` salió de
 * `use-cast.ts`.
 *
 * Es un atajo sobre el teclado en pantalla, nunca un sustituto: webOS y Tizen
 * traen el reconocimiento de voz a ratos. Regla heredada de `use-cast.ts`: **si
 * no va a funcionar, el botón no existe**, porque ofrecerlo y que no pase nada
 * es lo que de verdad parece roto.
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
 * Español de Latinoamérica, que es donde se usa esto. No da igual: con `es-ES`
 * el reconocedor tropieza con los nombres propios y el seseo.
 */
export const IDIOMA = "es-419";

/**
 * Las dos condiciones hacen falta: el constructor puede existir y el micrófono
 * estar fuera de alcance —una página por `http:` no tiene `mediaDevices`, y
 * esta app se prueba en la red de casa—, y el botón saldría para nada.
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
 * Los reconocedores devuelven «Guardianes de la galaxia.» con punto final, y
 * ese punto se manda tal cual a TMDB, donde estropea la coincidencia. Se quita
 * la puntuación de los extremos y **no la de dentro**: «Dr. Who» la lleva.
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
 * `no-speech` y `not-allowed` no significan nada desde el sofá, y la diferencia
 * importa: una se arregla repitiendo y la otra yendo a los ajustes.
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
