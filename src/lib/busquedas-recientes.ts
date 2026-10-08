/**
 * Las últimas búsquedas de este aparato, para volver a ellas de un toque.
 *
 * Viven en `localStorage` como el tamaño de texto (`tamano-texto.ts`): son de
 * quien usa este aparato, no de la familia entera, y no merecen servidor.
 * La lógica es pura y se prueba aparte; lo del navegador va al final.
 */
export const CLAVE_BUSQUEDAS = "canalcasa:busquedas";

/** Cuántas se recuerdan: las que caben en dos líneas de fichas. */
export const MAX_BUSQUEDAS = 6;

/** La nueva delante; sin repetidas (sin mirar mayúsculas) ni vacías. */
export function agregarBusqueda(lista: string[], busqueda: string): string[] {
  const limpia = busqueda.trim().replace(/\s+/g, " ");
  if (limpia.length < 2) return lista;
  const clave = limpia.toLocaleLowerCase("es");
  const resto = lista.filter((item) => item.toLocaleLowerCase("es") !== clave);
  return [limpia, ...resto].slice(0, MAX_BUSQUEDAS);
}

export function quitarBusqueda(lista: string[], busqueda: string): string[] {
  return lista.filter((item) => item !== busqueda);
}

/** Lo guardado, tolerando basura: cualquier cosa que no sea texto se ignora. */
export function interpretarBusquedas(crudo: string | null): string[] {
  if (!crudo) return [];
  try {
    const valor: unknown = JSON.parse(crudo);
    return Array.isArray(valor)
      ? valor.filter((item): item is string => typeof item === "string").slice(0, MAX_BUSQUEDAS)
      : [];
  } catch {
    return [];
  }
}

const EVENTO = "canalcasa:busquedas";

/**
 * Para `useSyncExternalStore`: el texto guardado tal cual. Se devuelve la
 * cadena y no la lista porque la instantánea tiene que ser estable entre
 * lecturas; quien la usa la interpreta con `useMemo`.
 */
export function leerBusquedasCrudas(): string | null {
  try {
    return localStorage.getItem(CLAVE_BUSQUEDAS);
  } catch {
    return null;
  }
}

export function guardarBusquedas(lista: string[]) {
  try {
    if (lista.length === 0) localStorage.removeItem(CLAVE_BUSQUEDAS);
    else localStorage.setItem(CLAVE_BUSQUEDAS, JSON.stringify(lista));
  } catch {
    // Modo privado o almacenamiento bloqueado: se pierde al cerrar, nada más.
  }
  window.dispatchEvent(new Event(EVENTO));
}

/** Avisa al cambiar aquí o en otra pestaña. */
export function suscribirBusquedas(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("storage", avisar);
  };
}
