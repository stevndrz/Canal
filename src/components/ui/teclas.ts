/**
 * Las flechas dentro de un grupo de opciones (Segmentado, PantallaMensaje).
 *
 * Lógica pura y aparte para poder probarla sin navegador: es donde se decide
 * si una flecha se queda dentro del grupo o se le deja al mando
 * (`use-spatial-nav`) para que salte a lo que haya al lado.
 */

export type Orientacion = "horizontal" | "vertical" | "ambas";

/**
 * El índice al que lleva una tecla, o `null` si la tecla no es de este grupo.
 *
 * **En el borde devuelve `null`, no da la vuelta.** Con el mando, → en la
 * última opción tiene que salir del grupo hacia el control de al lado; si
 * diera la vuelta a la primera, el foco quedaría atrapado en el segmentado y
 * no habría forma de llegar a lo que hay a su derecha. `null` significa
 * «no es asunto mío»: quien llama no hace `preventDefault` y la flecha sigue
 * su camino hasta el hook de navegación.
 *
 * Inicio y Fin sí saltan a los extremos: no los usa ningún mando y en un
 * teclado es lo que se espera de un grupo de radios.
 */
export function indiceSiguiente(
  actual: number,
  total: number,
  tecla: string,
  orientacion: Orientacion = "horizontal",
): number | null {
  if (total <= 0) return null;
  const horizontal = orientacion !== "vertical";
  const vertical = orientacion !== "horizontal";

  let paso = 0;
  if (horizontal && tecla === "ArrowRight") paso = 1;
  else if (horizontal && tecla === "ArrowLeft") paso = -1;
  else if (vertical && tecla === "ArrowDown") paso = 1;
  else if (vertical && tecla === "ArrowUp") paso = -1;
  else if (tecla === "Home") return actual === 0 ? null : 0;
  else if (tecla === "End") return actual === total - 1 ? null : total - 1;
  else return null;

  const destino = actual + paso;
  return destino < 0 || destino >= total ? null : destino;
}

/**
 * «¿Borrar 3 favoritos?», con el singular bien puesto.
 *
 * La confirmación repite la cifra a propósito: «¿Seguro?» no dice cuánto se
 * pierde, y «Borrar 120 favoritos» hace dudar a quien pensaba borrar dos.
 */
export function contarCosas(cantidad: number, singular: string, plural: string): string {
  return `${cantidad.toLocaleString("es")} ${cantidad === 1 ? singular : plural}`;
}
