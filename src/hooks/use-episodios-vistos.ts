"use client";

import { usePersistedSet } from "./use-persisted-set";

const CLAVE = "canalcasa:episodios-vistos";

/**
 * Los capítulos ya vistos en este aparato.
 *
 * Sin cuenta ni sincronización —igual que «Mi lista» y los favoritos de
 * canal—, así que lo marcado en el teléfono no aparece en el televisor.
 *
 * Las claves son las de `claveDeEpisodio()` (`"tv-tmdb-125988-t1e3"`), las
 * mismas que usa el progreso. Ver `lib/episodios-vistos.ts` para por qué esto
 * no puede salir de `progreso.ts`: allí terminar algo lo borra.
 */
export function useEpisodiosVistos() {
  return usePersistedSet<string>(CLAVE);
}
