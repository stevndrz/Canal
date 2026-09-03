/**
 * Cerrar la aplicación cuando ya no hay adónde volver.
 *
 * En el navegador, Atrás en la pantalla de inicio no hace nada y está bien: la
 * pestaña se cierra sola. **Empaquetada en un televisor, esa misma pantalla es
 * una trampa**: el mando no tiene más salida que Atrás, y si la app se la come
 * hay que apagar la tele. Samsung además lo exige para publicar — Atrás en la
 * primera pantalla tiene que devolver al menú del televisor.
 *
 * Cada plataforma lo dice a su manera y ninguna existe en las otras, así que
 * se prueban por orden y la última es no hacer nada, que es lo correcto en un
 * navegador de escritorio.
 */

/** Lo que cada plataforma inyecta en `window`; ninguna viene con tipos. */
interface VentanaDeTelevisor {
  tizen?: {
    application?: {
      getCurrentApplication?: () => { exit?: () => void } | undefined;
    };
  };
  webOS?: { platformBack?: () => void };
  /**
   * El puente de la cáscara de Android TV (`empaque/android`), que no existe
   * en ningún estándar: Android no da a la página ninguna forma de cerrar la
   * aplicación que la contiene, así que la cáscara expone esta única función.
   */
  CanalCasaAndroid?: { salir?: () => void };
}

/**
 * Devuelve `true` si de verdad cerró algo.
 *
 * Quien llama lo necesita para no quedarse a medias: si esto devuelve `false`
 * estamos en un navegador y la pantalla debe seguir como estaba, sin mensajes
 * ni pantallas de despedida que no llevan a ningún sitio.
 */
export function salirDeLaApp(): boolean {
  if (typeof window === "undefined") return false;
  const ventana = window as unknown as VentanaDeTelevisor;

  try {
    const actual = ventana.tizen?.application?.getCurrentApplication?.();
    if (actual?.exit) {
      actual.exit();
      return true;
    }
  } catch {
    /* El objeto existe pero el privilegio no: se sigue probando. */
  }

  try {
    if (ventana.webOS?.platformBack) {
      ventana.webOS.platformBack();
      return true;
    }
  } catch {
    /* Igual que arriba. */
  }

  try {
    if (ventana.CanalCasaAndroid?.salir) {
      ventana.CanalCasaAndroid.salir();
      return true;
    }
  } catch {
    /* Igual que arriba. */
  }

  return false;
}
