/**
 * Las teclas del mando que llegan SIN nombre.
 *
 * En un navegador de escritorio `event.key` trae "MediaPlayPause" y basta con
 * mirarlo. En un televisor no siempre: Tizen 4 y 5 son Chromium 56 y 69, y ahí
 * las teclas de reproducción llegan **solo con `keyCode`** — `event.key` viene
 * como "Unidentified" o directamente vacío. El reproductor las escuchaba por
 * nombre, así que en la tele el botón de pausa del mando no hacía nada.
 *
 * Los códigos no son de Samsung: son los `VK_*` del estándar de mandos que
 * comparten Tizen, webOS y Android TV. Por eso una sola tabla sirve para los
 * tres y no hay una por plataforma.
 *
 * Ojo con lo que NO está aquí: las flechas, OK y Atrás. Esas sí llegan con
 * nombre en todas partes, y duplicarlas por código sería invitar a que un día
 * las dos rutas discrepen. Atrás vive en `use-spatial-nav.ts`, que es quien la
 * necesita.
 */

/** Lo que el reproductor sabe hacer con una tecla del mando. */
export type AccionDeMando = "reproducir" | "parar" | "canal-arriba" | "canal-abajo";

/**
 * Código numérico → acción.
 *
 * `MediaPlay` (415) y `MediaPause` (19) van los dos a "reproducir" a
 * propósito: el mando de una tele suele traer un solo botón que alterna, y
 * cuando trae dos, mandar el alternador es lo que la gente espera —pulsar
 * ▶ con el vídeo en marcha no debería hacer nada raro—.
 */
const POR_CODIGO: ReadonlyMap<number, AccionDeMando> = new Map([
  [10252, "reproducir"], // MediaPlayPause (Tizen)
  [415, "reproducir"], // MediaPlay
  [19, "reproducir"], // MediaPause
  [413, "parar"], // MediaStop
  [427, "canal-arriba"], // ChannelUp
  [428, "canal-abajo"], // ChannelDown
]);

/** Nombre de `event.key` → acción, para los navegadores que sí lo mandan. */
const POR_NOMBRE: ReadonlyMap<string, AccionDeMando> = new Map([
  ["MediaPlayPause", "reproducir"],
  ["MediaPlay", "reproducir"],
  ["MediaPause", "reproducir"],
  ["MediaTrackNext", "canal-arriba"],
  ["MediaTrackPrevious", "canal-abajo"],
  ["ChannelUp", "canal-arriba"],
  ["ChannelDown", "canal-abajo"],
  ["MediaStop", "parar"],
]);

/**
 * Qué pide esta pulsación, o `null` si no es una tecla de mando.
 *
 * Se mira **primero el nombre**: es lo que manda un navegador moderno y lo que
 * se puede leer en una prueba sin inventarse códigos. El código es el respaldo
 * para los televisores viejos.
 */
export function accionDeTecla(evento: {
  key?: string;
  keyCode?: number;
}): AccionDeMando | null {
  const porNombre = evento.key ? POR_NOMBRE.get(evento.key) : undefined;
  if (porNombre) return porNombre;
  return (evento.keyCode !== undefined ? POR_CODIGO.get(evento.keyCode) : undefined) ?? null;
}

/**
 * Los nombres que hay que pedirle a Tizen con `registerKey` para que lleguen.
 *
 * En un televisor Samsung, las teclas de reproducción **no se entregan a la
 * aplicación** hasta que esta las reclama. Sin esta lista, la tabla de arriba
 * no llega a consultarse nunca: el evento no ocurre. Lo hace el arranque del
 * paquete (`empaque/tizen/index.html`), que es el único sitio donde el objeto
 * `tizen` existe.
 */
export const TECLAS_A_REGISTRAR = [
  "MediaPlayPause",
  "MediaPlay",
  "MediaPause",
  "MediaStop",
  "ChannelUp",
  "ChannelDown",
] as const;
