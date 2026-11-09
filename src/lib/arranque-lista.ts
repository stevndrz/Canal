import type { ViewId } from "./types";

/**
 * Cuándo pedir la lista completa de canales (`/api/canales`).
 *
 * El HTML ya trae los ~200 que la primera pantalla pinta. Los otros 7.600 se
 * pedían nada más montar, y medido en un perfil de tele lenta (CPU ×12) eso
 * son 0,75 s de JavaScript —interpretar 1 MB de JSON, reconstruir 7.822
 * canales y recalcular todo lo que cuelga de ellos— justo en los segundos en
 * que el televisor está hidratando la página y arrancando el vídeo.
 *
 * El trabajo es el mismo; lo que cambia es que ya no compite con el arranque.
 * Y si la lista hace falta YA, no se espera:
 *
 *  - el último canal visto no venía en el recorte: sin la lista entera la tele
 *    abriría en otro y cambiaría a los segundos;
 *  - la persona ya está en Canales o en Buscar, que son la lista entera.
 *
 * Devuelve los milisegundos que esperar; 0 es «ahora».
 */
export const ESPERA_TELE_MS = 3000;
export const ESPERA_MS = 1200;

export function esperaParaLaLista({
  vista,
  ultimoFueraDelRecorte,
  esTV,
}: {
  vista: ViewId;
  ultimoFueraDelRecorte: boolean;
  esTV: boolean;
}): number {
  if (ultimoFueraDelRecorte || vista === "canales" || vista === "buscar") return 0;
  return esTV ? ESPERA_TELE_MS : ESPERA_MS;
}
