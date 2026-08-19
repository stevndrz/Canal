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
