/**
 * Lo que el sistema enseña de la película fuera de la app: la pantalla de
 * bloqueo, el centro de control, los auriculares, el reloj. Aquí solo lo que
 * se puede decidir sin navegador; quien lo conecta es `use-sesion-de-medios.ts`.
 */

export interface MetadatosDeMedios {
  title: string;
  artist: string;
  artwork: { src: string; sizes?: string; type?: string }[];
}

/** El título y la carátula, en la forma de `MediaMetadata`. Sin carátula, sin `artwork`. */
export function metadatosDe(titulo: string, caratula?: string | null): MetadatosDeMedios {
  return {
    title: titulo.trim() || "CanalCasa",
    artist: "CanalCasa",
    // Solo http(s): acaba en manos del sistema, fuera de la página.
    artwork: caratula && /^https?:\/\//i.test(caratula) ? [{ src: caratula }] : [],
  };
}

/**
 * La posición para la barra de la pantalla de bloqueo, o `null` si todavía no
 * se puede decir: `setPositionState` lanza con una duración que no es un
 * número finito (un directo, o antes de cargar) o con una posición mayor.
 */
export function posicionDe(duracion: number, posicion: number, velocidad: number): { duration: number; position: number; playbackRate: number } | null {
  if (!Number.isFinite(duracion) || duracion <= 0 || !Number.isFinite(posicion)) return null;
  return { duration: duracion, position: Math.min(Math.max(0, posicion), duracion), playbackRate: velocidad > 0 ? velocidad : 1 };
}

/** A dónde lleva un salto desde los auriculares o la pantalla de bloqueo, sin salirse de la película. */
export function destinoDeSalto(actual: number, duracion: number, segundos: number): number {
  const tope = Number.isFinite(duracion) && duracion > 0 ? duracion : Infinity;
  return Math.min(Math.max(0, actual + segundos), tope);
}

/**
 * Cuánto se mantiene encendida la pantalla sin que pase nada. Con la película
 * en marcha el navegador ya la mantiene; esto es para la sala en pausa o
 * esperando a alguien. Pasado este rato quieta, se suelta: un teléfono
 * olvidado en una sala no debe quedarse encendido toda la noche.
 */
export const PANTALLA_ENCENDIDA_MS = 20 * 60_000;
