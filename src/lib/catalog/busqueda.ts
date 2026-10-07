/**
 * Lo que `/api/buscar` contesta, leído en un solo sitio.
 *
 * Hay cuatro respuestas posibles y antes la interfaz solo distinguía una: todo
 * lo que no fueran resultados acababa en «Sin resultados para…». Pero «no hay
 * ninguna película con ese nombre», «TMDB no contesta» y «has buscado
 * demasiado seguido» piden cosas distintas a quien mira: probar otra palabra,
 * esperar unos minutos o esperar unos segundos.
 */
export type EstadoBusqueda = "ok" | "no-disponible" | "limitado";

export interface RespuestaBusqueda<T> {
  estado: EstadoBusqueda;
  resultados: T[];
}

/**
 * Interpreta el código HTTP y el cuerpo de `/api/buscar`.
 *
 * El 429 lo pone `limite-peticiones.ts` con su propio cuerpo (sin
 * `resultados`), así que se mira el código antes que el cuerpo. Un cuerpo que
 * no se entiende se trata como «no disponible»: mejor decir que algo falló que
 * fingir que no había nada.
 */
export function leerRespuestaBusqueda<T>(status: number, cuerpo: unknown): RespuestaBusqueda<T> {
  if (status === 429) return { estado: "limitado", resultados: [] };

  const datos = (cuerpo ?? {}) as { resultados?: unknown; disponible?: unknown };
  const resultados = Array.isArray(datos.resultados) ? (datos.resultados as T[]) : null;

  if (resultados === null || datos.disponible === false || status >= 500) {
    return { estado: "no-disponible", resultados: [] };
  }
  return { estado: "ok", resultados };
}
