/**
 * Distinguir un toque «en el vídeo» de un toque en un control.
 *
 * Tocar la imagen pausa y reanuda, que es lo que hace cualquier reproductor y
 * lo que la gente prueba primero. El problema es que el marco del reproductor
 * también contiene la barra de controles, la guía y los avisos: sin este
 * filtro, pulsar «Siguiente» pausaría además el vídeo, y abrir la guía lo
 * dejaría congelado detrás.
 *
 * Se mira el ancestro y no solo el destino porque el clic suele caer en el
 * `<svg>` o en el `<span>` de dentro del botón, no en el botón.
 *
 * Es DOM puro, así que se verifica con Playwright contra la app de verdad —el
 * reparto que explica `docs/ARQUITECTURA.md`— y no con jsdom.
 */
const INTERACTIVO = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  '[role="button"]',
  "[data-nav]",
  ".player-bar",
  ".guia",
].join(",");

export function esToqueEnElVideo(destino: EventTarget | null): boolean {
  if (!(destino instanceof Element)) return false;
  return !destino.closest(INTERACTIVO);
}
