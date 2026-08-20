/**
 * Un canal de la lista.
 *
 * **Cada campo que se añada aquí viaja 7.822 veces al navegador.** La lista se
 * serializa entera dentro del HTML de la portada, así que un campo de treinta
 * caracteres son 230 KB más que hay que descargar y, sobre todo, interpretar
 * — que en un televisor barato es lo que se nota.
 *
 * Por eso ya no están: `description` (un "Señal en vivo de X" generado que no
 * leía nadie), `logoText` (`channelMark()` lo deriva del nombre), `isFavorite`
 * (el estado real vive en el store, indexado por `streamUrl`) e `isLive`
 * (valía `true` en los 7.822). Entre los cuatro sumaban 1,4 MB.
 *
 * Regla: si un valor se puede calcular en el cliente, se calcula en el
 * cliente; si es constante, no se manda.
 */
export interface Channel {
  id: number;
  name: string;
  number: string;
  category: string;
  logoUrl: string;
  streamUrl: string;
  /**
   * Ausentes —no vacíos— cuando no hay guía EPG. Se omiten en vez de mandarse
   * como cadena vacía justo por lo de arriba: una clave presente con valor
   * vacío cuesta lo mismo que una con contenido.
   */
  currentProgram?: string;
  nextProgram?: string;
  /**
   * Inicio y fin del programa actual, en milisegundos.
   *
   * Solo con el título no se puede dibujar cuánto lleva emitido: hace falta
   * saber dónde empieza y dónde acaba. `epg.ts` ya los tiene; antes se
   * descartaban al construir el canal porque nadie los usaba.
   *
   * Ausentes cuando no hay guía, que es lo que distingue "sin datos" de
   * "empieza ahora mismo".
   */
  currentStart?: number;
  currentEnd?: number;
  nextStart?: number;
}

/** Vistas del App Shell. "player" es pantalla completa, no una vista de nav. */
export type ViewId =
  | "home"
  | "canales"
  | "favoritos"
  | "buscar"
  | "fuente"
  | "categorias"
  | "ajustes"
  | "player";

export interface PlaybackSettings {
  lowLatencyMode: boolean;
  enableWorker: boolean;
  liveBufferLatencyChasing: boolean;
  startUnmuted: boolean;
  engine: "auto" | "hls" | "mpegts";
  /**
   * Controles más grandes y con todas las palabras a la vista.
   *
   * No es un ajuste de accesibilidad escondido: es la diferencia entre una app
   * que usa quien ya conoce los iconos y una que usa cualquiera de la casa. Con
   * él, hasta los controles secundarios llevan su etiqueta.
   */
  bigControls: boolean;
  /**
   * Forzar la calidad más alta del stream en lugar de adaptarla al ancho de
   * banda.
   *
   * Por defecto HLS empieza bajo y sube según mide la conexión, que es lo
   * correcto con una línea justa: evita cortes. Con fibra esa prudencia se nota
   * como unos segundos borrosos cada vez que se cambia de canal, sin motivo.
   * Activado, arranca directamente en la mejor pista disponible.
   */
  calidadMaxima: boolean;
  /**
   * Cómo se encaja la imagen cuando su proporción no es la del marco.
   *
   * `contener` respeta la imagen entera y deja bandas; `llenar` recorta para
   * ocupar todo el marco. Muchos canales emiten en 4:3 dentro de un contenedor
   * 16:9, así que la elección es entre ver bandas o perder los bordes.
   */
  ajusteImagen: "contener" | "llenar";
}

export const DEFAULT_PLAYBACK: PlaybackSettings = {
  lowLatencyMode: true,
  enableWorker: true,
  liveBufferLatencyChasing: true,
  startUnmuted: true,
  engine: "auto",
  bigControls: false,
  calidadMaxima: false,
  ajusteImagen: "contener",
};
