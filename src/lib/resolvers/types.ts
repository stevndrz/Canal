/**
 * Contrato de `/api/stream`, compartido por el servidor y el navegador
 * (`ficha-reproductor.tsx`). Este archivo no puede importar nada que lea
 * `process.env`: llega hasta el cliente.
 */

/** Un servidor de reproducción: un iFrame de un proveedor externo. */
export interface ServidorStream {
  id: string;
  /** Lo que se lee en el botón ("Servidor 1", "Servidor 2"). */
  label: string;
  url: string;
}

/** La respuesta entera de `/api/stream`. */
export interface RespuestaStream {
  servidores: ServidorStream[];
}
