export interface Channel {
  id: number;
  name: string;
  number: string;
  category: string;
  description: string;
  logoText: string;
  logoUrl: string;
  streamUrl: string;
  isFavorite: boolean;
  isLive: boolean;
  /** Vacíos cuando no hay guía EPG real: nunca se rellenan con texto inventado. */
  currentProgram: string;
  nextProgram: string;
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
  | "categorias"
  | "ajustes"
  | "player";

export interface PlaybackSettings {
  lowLatencyMode: boolean;
  enableWorker: boolean;
  liveBufferLatencyChasing: boolean;
  startUnmuted: boolean;
  engine: "auto" | "hls" | "mpegts";
}

export const DEFAULT_PLAYBACK: PlaybackSettings = {
  lowLatencyMode: true,
  enableWorker: true,
  liveBufferLatencyChasing: true,
  startUnmuted: true,
  engine: "auto",
};
