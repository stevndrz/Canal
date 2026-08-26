/**
 * Contrato de `/api/stream`, compartido por el servidor y el navegador
 * (`ficha-reproductor.tsx`). Este archivo no puede importar nada que lea
 * `process.env`: llega hasta el cliente.
 */

/**
 * Un servidor de reproducción.
 *
 * - `embed` (por omisión): página con reproductor ajeno → iFrame.
 * - `video`: enlace directo (.mp4/.m3u8) → `<video>` propio, sin anuncios.
 */
export interface ServidorStream {
  id: string;
  /** Lo que se lee en el botón ("Servidor 1", "Servidor 2"). */
  label: string;
  url: string;
  tipo?: "embed" | "video";
}

/** La respuesta entera de `/api/stream`. */
export interface RespuestaStream {
  servidores: ServidorStream[];
}
