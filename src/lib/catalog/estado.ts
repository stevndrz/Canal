/**
 * En qué estado está el catálogo, dicho una sola vez.
 *
 * Antes cada pantalla lo adivinaba a su manera a partir de una lista vacía:
 * `/peliculas` decía «Tu catálogo está vacío» y pedía editar un JSON, la
 * búsqueda decía «Sin resultados» y el filtro «Nada con esos filtros». Las
 * tres culpaban a la persona de algo que era un fallo nuestro —o una clave
 * sin poner—, porque «no hay nada» y «no pudimos preguntar» llegaban con la
 * misma forma: `[]`.
 *
 * - `listo`: hay catálogo que enseñar.
 * - `sin-configurar`: no hay credencial de TMDB. No es un fallo: es una
 *   instalación a medias, y no se arregla reintentando.
 * - `no-disponible`: hay credencial, pero TMDB no contestó (caído, lento,
 *   clave revocada). Suele arreglarse solo.
 */
export type EstadoCatalogo = "listo" | "sin-configurar" | "no-disponible";

/**
 * Decide el estado a partir de lo que se sabe tras pedir las filas.
 *
 * Basta con que UNA fila llegue para estar `listo`: si TMDB contestó a la
 * mitad, se enseña esa mitad en vez de una pantalla de error. Y lo escrito a
 * mano en `catalog.json` cuenta como catálogo aunque TMDB falte.
 */
export function estadoDelCatalogo({
  configurado,
  filasConTitulos,
  propias = 0,
}: {
  /** Hay credencial de TMDB. */
  configurado: boolean;
  /** Cuántas filas de TMDB llegaron con algún título. */
  filasConTitulos: number;
  /** Cuántos títulos escritos a mano hay en `catalog.json`. */
  propias?: number;
}): EstadoCatalogo {
  if (filasConTitulos > 0 || propias > 0) return "listo";
  return configurado ? "no-disponible" : "sin-configurar";
}
