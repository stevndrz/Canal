import { PATRON_TELEVISOR } from "@/lib/dispositivo";

/**
 * Tamaño del texto: la preferencia de lectura de quien usa este aparato.
 *
 * Vive en `localStorage` y la aplica un atributo en <html> (`data-texto`) que
 * `shell.css` convierte en `--escala-texto`. Toda la escala tipográfica —la de
 * las hojas y la de Tailwind— multiplica por ella, así que un solo atributo
 * agranda la app entera.
 */
export type TamanoTexto = "normal" | "grande" | "enorme";

export const TAMANOS_TEXTO: readonly TamanoTexto[] = ["normal", "grande", "enorme"];

export const CLAVE_TAMANO_TEXTO = "canalcasa:texto";

export function leerTamanoTexto(): TamanoTexto {
  try {
    const guardado = localStorage.getItem(CLAVE_TAMANO_TEXTO);
    return guardado === "grande" || guardado === "enorme" ? guardado : "normal";
  } catch {
    return "normal";
  }
}

export function aplicarTamanoTexto(tamano: TamanoTexto) {
  const raiz = document.documentElement;
  if (tamano === "normal") delete raiz.dataset.texto;
  else raiz.dataset.texto = tamano;
  try {
    if (tamano === "normal") localStorage.removeItem(CLAVE_TAMANO_TEXTO);
    else localStorage.setItem(CLAVE_TAMANO_TEXTO, tamano);
  } catch {
    // Modo privado o almacenamiento bloqueado: vale para esta visita.
  }
  window.dispatchEvent(new Event(EVENTO_TAMANO_TEXTO));
}

const EVENTO_TAMANO_TEXTO = "canalcasa:texto";

/** Para `useSyncExternalStore`: avisa al cambiar aquí o en otra pestaña. */
export function suscribirTamanoTexto(avisar: () => void) {
  window.addEventListener(EVENTO_TAMANO_TEXTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO_TAMANO_TEXTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}

/**
 * El guion que corre en <head> antes de pintar.
 *
 * Tiene que ser un guion en línea y no un efecto de React: un efecto corre
 * después del primer pintado, y la app se vería un instante en un tamaño y
 * saltaría a otro. En un televisor ese salto es toda la pantalla.
 *
 * Hace dos cosas: marca `data-pantalla="tv"` con la misma tabla que usa el
 * servidor, y recupera el tamaño de texto guardado.
 */
export const GUION_ARRANQUE_PANTALLA = `(function(){var d=document.documentElement;try{if(${PATRON_TELEVISOR.toString()}.test(navigator.userAgent))d.setAttribute("data-pantalla","tv");var t=localStorage.getItem(${JSON.stringify(CLAVE_TAMANO_TEXTO)});if(t==="grande"||t==="enorme")d.setAttribute("data-texto",t);}catch(e){}})();`;
