/**
 * En la tele, con el mando entregado al reproductor de un proveedor: si hay
 * que sacar a la persona sola, cuándo, y si se tira ese servidor.
 *
 * El rescate existe porque en una Samsung, con el foco dentro de un iframe
 * ajeno, ninguna tecla llega a esta página —ni Atrás—: si el reproductor no
 * arranca, la persona se queda atrapada. Pero el reloj no sabe si el vídeo va
 * (desde fuera de un iframe ajeno no se puede saber), y antes, pasados 20 s,
 * sacaba a TODOS y además descartaba el servidor. En la tele del dueño (TCL,
 * la app de Android) eso tiraba Vimeus con la película en latino sonando, le
 * quitaba el mando y saltaba a Vidzee, en inglés y con sus anuncios: el «Se
 * saltó 1 servidor» de sus fotos.
 *
 * Sin DOM ni React, para poder probar la regla entera.
 */

/**
 * Con puerta antirrobot (Turnstile y parecidas): en una tele no se pasa
 * nunca, así que a los 8 s es un caso perdido en cualquier aparato. Se saca a
 * la persona y se tira el servidor para que el siguiente quede activo solo.
 */
export const ESPERA_CON_PUERTA_MS = 8_000;

/**
 * Sin puerta, donde Atrás no llega (Samsung): se le devuelve el mando a los
 * 20 s, pero el servidor se queda. Puede estar sonando —arranca solo con el
 * `autoplay` del iframe— y tirarlo cortaba la película. Si no iba, la
 * persona tiene ya a la vista los demás servidores.
 */
export const ESPERA_SIN_PUERTA_MS = 20_000;

export interface Rescate {
  esperaMs: number;
  /** Además de devolver el mando, pasar al siguiente servidor. */
  descartar: boolean;
}

export function rescateEnTele({
  conPuerta,
  atrasLlega,
}: {
  /** El servidor esconde su reproductor tras una comprobación antirrobot. */
  conPuerta: boolean;
  /**
   * Atrás llega siempre, esté donde esté el foco: la cáscara de Android lo
   * atiende antes que la WebView (`MainActivity.alPulsarAtras`).
   */
  atrasLlega: boolean;
}): Rescate | null {
  if (conPuerta) return { esperaMs: ESPERA_CON_PUERTA_MS, descartar: true };
  // Con Atrás a mano nadie queda atrapado: no se rescata, se deja ver.
  if (atrasLlega) return null;
  return { esperaMs: ESPERA_SIN_PUERTA_MS, descartar: false };
}
