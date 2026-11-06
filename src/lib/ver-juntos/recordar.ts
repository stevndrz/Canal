import { leerSubtitulos } from "./catalogo";
import { normalizarCodigo, type VideoDeSala } from "./sala";

/**
 * La sala sobrevive a salir de Mi enlace.
 *
 * Mi enlace se desmonta al cambiar de sección —pulsar Atrás en el mando basta—,
 * y con ella se perdía la sala: el anfitrión volvía a una pantalla vacía y el
 * otro se quedaba esperando a alguien que ya no estaba. Guardada aquí, al volver
 * se entra sola en la misma sala y con la misma película.
 *
 * `sessionStorage` y no `localStorage`: dura lo que dure la pestaña o la app
 * abierta. Mañana no tiene sentido volver a una sala de ayer.
 */

const CLAVE = "canalcasa:ver-juntos";

export interface SalaRecordada {
  codigo: string;
  anfitrion: boolean;
  /** Lo que el anfitrión tenía puesto. */
  video: (VideoDeSala & { id: string }) | null;
}

export function leerSalaRecordada(): SalaRecordada | null {
  try {
    const crudo = JSON.parse(window.sessionStorage.getItem(CLAVE) ?? "null") as Record<string, unknown> | null;
    if (!crudo || typeof crudo !== "object") return null;
    const codigo = normalizarCodigo(String(crudo.codigo ?? ""));
    if (!codigo) return null;
    const v = crudo.video as Record<string, unknown> | null;
    const video =
      v && typeof v.id === "string" && typeof v.url === "string" && /^https?:\/\//i.test(v.url)
        ? {
            id: v.id,
            url: v.url,
            titulo: typeof v.titulo === "string" ? v.titulo : "",
            subtitulos: leerSubtitulos(v.subtitulos),
          }
        : null;
    return { codigo, anfitrion: crudo.anfitrion === true, video };
  } catch {
    // Sin almacenamiento (modo privado, tele que no lo da): no se recuerda.
    return null;
  }
}

export function recordarSala(sala: SalaRecordada | null): void {
  try {
    if (sala) window.sessionStorage.setItem(CLAVE, JSON.stringify(sala));
    else window.sessionStorage.removeItem(CLAVE);
  } catch {
    // Igual que arriba: es una comodidad, no algo de lo que dependa nada.
  }
}
