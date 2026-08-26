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
  /**
   * El proveedor esconde su reproductor tras una comprobación antirrobot que
   * en un televisor puede no pasar nunca, dejando el marco recargándose. No se
   * puede detectar desde fuera, así que la ficha ofrece antes la salida.
   */
  puertaAntirrobot?: boolean;
  /** Trae subtítulos en español. Se enseña en el botón: es lo que se busca. */
  subtitulos?: boolean;
  /**
   * Este proveedor responde con un estado HTTP distinto cuando NO tiene el
   * título, así que se le puede preguntar antes de ofrecerlo. Ver
   * `lib/catalog/disponibilidad.ts` para la tabla de lo comprobado.
   */
  compruebaPorEstado?: boolean;
}

/** La respuesta entera de `/api/stream`. */
export interface RespuestaStream {
  servidores: ServidorStream[];
}
