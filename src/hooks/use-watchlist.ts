"use client";

import { usePersistedSet } from "./use-persisted-set";

const CLAVE = "canalcasa:watchlist";

/**
 * «Mi lista»: películas y series marcadas en este aparato.
 *
 * Sin cuenta ni sincronización — igual que los favoritos de canales—, así que
 * lo marcado aquí no aparece en otro televisor ni en el teléfono.
 *
 * Las claves son las de `claveCatalogo()` (`"movie-tmdb-550"`), las mismas
 * que ya identifican una tarjeta: un `tmdbId` a secas no basta, porque una
 * película y una serie pueden compartir el mismo número.
 */
export function useWatchlist() {
  return usePersistedSet<string>(CLAVE);
}
