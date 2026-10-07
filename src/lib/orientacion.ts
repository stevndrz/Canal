import { esIPhone, esTelevisorUA } from "@/lib/dispositivo";

/**
 * Girar el teléfono Android a horizontal al entrar a pantalla completa.
 *
 * Sin esto, quien sostiene el teléfono en vertical y pulsa «Pantalla» ve una
 * franja de 412×232 en una pantalla de 412×915: la pantalla completa no le ha
 * dado nada. Girada, la imagen pasa a 732×412, que es lo que hace YouTube.
 *
 * Solo donde tiene sentido, y por eso tantas guardas:
 * - **iPhone**: `webkitEnterFullscreen` abre el reproductor del sistema, que ya
 *   gira solo. Y `screen.orientation.lock` no existe en iOS.
 * - **Televisor**: ya es horizontal, y algunas teles rechazan el bloqueo con
 *   un error que no aporta nada.
 * - **Ratón**: un monitor no gira; bloquear ahí no hace nada o, peor, lanza.
 * - **Tableta**: se sostiene de cualquier manera y el vídeo cabe bien en las
 *   dos; que decida quien la sostiene, no la app.
 * - **Sin pantalla completa concedida**: Chrome solo deja bloquear la
 *   orientación dentro de ella, así que se llama DESPUÉS del `await` de
 *   `requestFullscreen`.
 *
 * Nunca lanza: la WebView del APK (que ya va en horizontal por su manifiesto),
 * Firefox o iPadOS rechazan el bloqueo, y eso no puede tumbar la pantalla
 * completa que sí se consiguió.
 */
export async function girarAHorizontal(): Promise<void> {
  if (!puedeGirar()) return;
  const orientacion = screen.orientation as ScreenOrientation & {
    lock?: (tipo: "landscape") => Promise<void>;
  };
  try {
    await orientacion.lock?.("landscape");
  } catch {
    /* WebView del APK, iPadOS, Firefox…: se queda como está */
  }
}

/**
 * Devolver la orientación al sistema al salir.
 *
 * Hay que llamarlo en TODAS las salidas —el botón «Salir», Atrás, el gesto de
 * volver de Android, que solo dispara `fullscreenchange`—: si no, el teléfono
 * se queda girado en Inicio con la página pensada para vertical.
 */
export function soltarOrientacion(): void {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* sin bloqueo que soltar */
  }
}

/** Las guardas de `girarAHorizontal`, sueltas para poder probarlas. */
export function puedeGirar(): boolean {
  if (typeof window === "undefined" || typeof screen === "undefined") return false;
  if (esIPhone()) return false;
  if (esTelevisorUA(navigator.userAgent) || document.documentElement.dataset.pantalla === "tv") {
    return false;
  }
  if (!window.matchMedia?.("(pointer: coarse)").matches) return false;
  // Un teléfono no pasa de 600 px por el lado corto; una tableta sí.
  if (Math.min(screen.width, screen.height) > 600) return false;
  const orientacion = screen.orientation as (ScreenOrientation & { lock?: unknown }) | undefined;
  if (typeof orientacion?.lock !== "function") return false;
  return Boolean(document.fullscreenElement);
}
