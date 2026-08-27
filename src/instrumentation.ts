/**
 * Este archivo existe a propósito **vacío de trabajo**.
 *
 * Tuvo un «calentador» que, al arrancar el servidor, pedía las doce listas de
 * TMDB para que el primer visitante no pagara la espera. La idea era buena; la
 * ejecución no podía funcionar: bajo `cacheComponents`, `tmdb.ts` cachea sus
 * peticiones con la directiva `"use cache"` y un `cacheLife("days")`, y eso
 * **solo puede ejecutarse dentro de una petición**. Llamarlo desde `register()`
 * lanzaba en cada arranque:
 *
 *     ❌ No se pudo calentar el catálogo
 *        (Error: `cacheLife()` can only be called inside a "use cache" function.)
 *
 * Comprobado con la clave puesta: fallaba siempre, así que en producción nunca
 * calentó nada — solo dejaba un error en el arranque y la falsa impresión de
 * que el catálogo llegaba templado. Se retira en vez de dejarlo fingiendo.
 *
 * Si algún día hace falta de verdad, el camino soportado no es llamar a las
 * funciones cacheadas: es que algo pida la propia ruta por HTTP después de que
 * el servidor esté escuchando.
 */
export function register(): void {}
