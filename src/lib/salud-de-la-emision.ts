/**
 * Qué ha cambiado en la salud de un canal entre dos lecturas del reproductor.
 *
 * Existe por un fallo concreto. La comprobación estaba escrita como una
 * condición sobre el estado ACTUAL:
 *
 *     if (siguiente.streamError) onSalud(canal, false);
 *
 * Eso no es un flanco, es un nivel: mientras el canal siguiera en error, se
 * disparaba en cada render. Y cada disparo escribía en `localStorage`,
 * reordenaba los 7.822 canales por salud y repintaba la aplicación entera. Ver
 * `canales-caidos.ts` y `use-persisted-set.ts`.
 *
 * Aquí se compara con la lectura anterior y solo se responde en el **cambio**.
 * Vive suelta y sin React para poder probarla: `vitest.config.ts` usa
 * `environment: "node"`, así que las pruebas de render no son posibles y la
 * única forma de blindar esta lógica es sacarla del componente.
 */

/** Lo poco que hace falta saber de una lectura del reproductor. */
export interface LecturaDeSalud {
  streamError: boolean;
  isPlaying: boolean;
}

/**
 * `"cayo"` cuando el canal acaba de romperse, `"revivio"` cuando acaba de dar
 * imagen por primera vez, y `null` mientras no cambie nada.
 *
 * Sin lectura anterior (`undefined`) solo se informa de un error: que un canal
 * esté reproduciendo al montarse es lo normal, no una noticia.
 */
export function cambioDeSalud(
  previo: LecturaDeSalud | undefined,
  siguiente: LecturaDeSalud,
): "cayo" | "revivio" | null {
  if (siguiente.streamError) {
    // Solo el flanco: si ya estaba en error, no hay nada nuevo que contar.
    return previo?.streamError ? null : "cayo";
  }

  // Salir del error también es una noticia: el canal volvió.
  if (previo?.streamError) return siguiente.isPlaying ? "revivio" : null;

  if (!previo) return null;
  return siguiente.isPlaying && !previo.isPlaying ? "revivio" : null;
}
