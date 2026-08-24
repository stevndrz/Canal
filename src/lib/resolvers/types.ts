import type { MediaType } from "@/lib/catalog/types";

/**
 * Contrato del pipeline de reproducción, compartido por el servidor
 * (`/api/stream`) y el navegador (`ficha-reproductor.tsx`). Este archivo no
 * puede importar nada que lea `process.env`: llega hasta el cliente.
 */

/** Lo que pide la interfaz para reproducir un título concreto. */
export interface StreamTarget {
  tmdbId: number;
  type: MediaType;
  /** Título ya traducido que viene de la ficha; evita una ida a TMDB. */
  titulo?: string;
  /** Solo en series; por defecto 1. */
  season?: number;
  /** Solo en series; por defecto 1. */
  episode?: number;
}

/**
 * Un servidor de reproducción tal y como lo devuelve `/api/stream`.
 *
 * - `embed`: URL de una página con su propio reproductor → se mete en un
 *   `<iframe>` y desde fuera no se puede saber nada de lo que pasa dentro.
 * - `file`: enlace HTTPS directo a vídeo (.mp4 / .m3u8) → se reproduce en un
 *   `<video>` propio, sin iFrames ni publicidad del proveedor.
 */
export interface ServidorStream {
  id: string;
  /** Lo que se lee en el botón ("Servidor 1", "Servidor 2"). */
  label: string;
  kind: "embed" | "file";
  url: string;
}

/** La respuesta entera de `/api/stream`. */
export interface RespuestaStream {
  servidores: ServidorStream[];
}
