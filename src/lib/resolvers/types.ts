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
  /**
   * URL que va al `src` del iframe. En general coincide con `url`, pero
   * `vimeus` se sirve del proxy propio para que sus scripts de anuncios no
   * lleguen al reproductor. `disponibilidad.ts` usa `url` porque la
   * comprobación 404/500 debe ir contra el origen real.
   */
  urlEmbed?: string;
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
