/**
 * Qué capítulos ya se vieron.
 *
 * Va aparte de `progreso.ts` a propósito. Ahí terminar algo **borra** la
 * entrada —es lo que mantiene sola la fila de continuar—, así que esa memoria
 * no puede contestar «¿vi ya el capítulo 7?»: lo terminado y lo que nunca se
 * abrió le parecen lo mismo. Esto es un conjunto de claves de episodio, y solo
 * crece cuando algo se da por visto.
 *
 * Se marca por dos vías, y las dos hacen falta:
 *
 * 1. **Sola**, cuando el reproductor propio pasa del umbral de terminado. Solo
 *    ocurre con «Mi enlace» y los servidores «Directo».
 * 2. **A mano**, con el botón de cada fila de episodio. Es la única vía en los
 *    proveedores por iframe, que son la mayoría: desde fuera de un dominio
 *    ajeno no se puede saber si el capítulo llegó al final.
 *
 * Las claves son las de `claveDeTitulo()` (`"tv-tmdb-125988-t1e3"`), las
 * mismas que usa el progreso: así una sola cadena identifica un capítulo en
 * las dos memorias y no hay que traducir entre ellas.
 *
 * Sin React ni `localStorage` para poder probarlo: `vitest` corre en `node`.
 */

import { claveDeTitulo } from "./progreso";

/**
 * Un episodio concreto de un título.
 *
 * Los campos van en inglés —`season`/`episode`— y no en el castellano del
 * resto del módulo porque es **la forma que ya tiene `ResolvedEpisode`**, que
 * es lo que la ficha pasa. Traducirlos obligaría a un `map` en cada llamada
 * por no cambiar nada.
 */
export interface Episodio {
  season: number;
  episode: number;
}

/** La clave de un episodio, a partir de la clave del título. */
export function claveDeEpisodio(claveBase: string, episodio: Episodio): string {
  return claveDeTitulo(claveBase, episodio.season, episodio.episode);
}

/** ¿Está visto? */
export function estaVisto(vistos: ReadonlySet<string>, claveBase: string, episodio: Episodio): boolean {
  return vistos.has(claveDeEpisodio(claveBase, episodio));
}

/** Cuántos de estos episodios están vistos. Alimenta el «3/10» de la cabecera. */
export function cuantosVistos(
  vistos: ReadonlySet<string>,
  claveBase: string,
  episodios: readonly Episodio[],
): number {
  return episodios.filter((episodio) => estaVisto(vistos, claveBase, episodio)).length;
}

/**
 * El primero sin ver, que es por donde se sigue.
 *
 * Devuelve el primero de la lista si están todos vistos: quien acaba una
 * temporada y vuelve a entrar quiere el principio, no una pantalla que no
 * ofrece nada. `null` solo cuando no hay episodios.
 */
export function siguientePorVer<T extends Episodio>(
  vistos: ReadonlySet<string>,
  claveBase: string,
  episodios: readonly T[],
): T | null {
  if (episodios.length === 0) return null;
  return episodios.find((episodio) => !estaVisto(vistos, claveBase, episodio)) ?? episodios[0];
}

/** Las tres pestañas de la lista de episodios. */
export type FiltroEpisodios = "todos" | "porver" | "vistos";

/**
 * La lista filtrada por la pestaña activa.
 *
 * «Por ver» y «Vistos» son vistas de la MISMA lista, en el mismo orden: nada
 * se reordena al cambiar de pestaña, solo desaparecen filas. Reordenar aquí
 * haría que el capítulo que estabas mirando saltara de sitio al marcarlo.
 */
export function filtrarEpisodios<T extends Episodio>(
  episodios: readonly T[],
  vistos: ReadonlySet<string>,
  claveBase: string,
  filtro: FiltroEpisodios,
): T[] {
  if (filtro === "todos") return [...episodios];
  const quiero = filtro === "vistos";
  return episodios.filter((episodio) => estaVisto(vistos, claveBase, episodio) === quiero);
}
