/**
 * Salas de «Ver juntos»: cómo se llaman y qué viaja por ellas.
 *
 * Sin `node:crypto` ni nada de servidor: esto lo importan los componentes. La
 * firma vive aparte, en `firma.ts`. En la versión anterior estaban juntas y el
 * cliente importaba el módulo que traía `createHmac`.
 */

import type { SubtitleTrack } from "@/lib/catalog/types";
import { leerSubtitulos } from "./catalogo";

/** Cabecera con la que el navegador le enseña su llave a `/api/pusher/auth`. */
export const CABECERA_LLAVE = "x-sala-llave";

/** Forma del canal de la sala (`canalDeLaSala` en `vinculo.ts`). */
export const CANAL_SALA = /^presence-sala-[0-9a-f]{32}$/;

/**
 * Qué película tiene puesta la sala. Quien entra la recibe de quien ya está.
 */
export interface VideoDeSala {
  url: string;
  titulo: string;
  /** Los de «Nuestras películas»; los de Mi enlace no traen. */
  subtitulos?: SubtitleTrack[];
}

/**
 * La película elegida y quién y cuándo la eligió.
 *
 * **La última elegida manda.** «Cuándo» no es una hora —el reloj de una tele
 * puede ir minutos desviado— sino un contador: quien elige pone uno más que
 * el más alto que conoce. Al encontrarse dos aparatos, gana el número mayor,
 * y a igual número, el `por` mayor (para que los dos decidan lo mismo). Cada
 * aparato la recuerda en `localStorage`: si ayer se eligió en el PC, hoy la
 * tele la recibe del PC al entrar, aunque ella recordara otra más vieja.
 */
export interface PeliculaDeSala {
  video: VideoDeSala;
  version: number;
  /** El `id` del aparato que la eligió. Mientras esté en la sala, dirige él. */
  por: string;
}

export function masNueva(a: PeliculaDeSala | null, b: PeliculaDeSala | null): PeliculaDeSala | null {
  if (!a) return b;
  if (!b) return a;
  if (a.version !== b.version) return a.version > b.version ? a : b;
  return a.por >= b.por ? a : b;
}

/**
 * Quién dirige: su pulso corrige a los demás.
 *
 * Quien eligió la película, si está en la sala; si no, quien lleva más tiempo
 * dentro (`orden` es el orden de llegada que ve este aparato). Así, al entrar
 * alguien nuevo no le quita el mando a quien ya estaba viendo —su pulso, en el
 * segundo 0, arrastraría a los demás al principio— y si quien dirige se va, lo
 * hereda el que queda.
 */
export function quienDirige(pelicula: PeliculaDeSala | null, orden: readonly string[]): string | null {
  if (pelicula && orden.includes(pelicula.por)) return pelicula.por;
  return orden[0] ?? null;
}

/**
 * Un mensaje de la sala.
 *
 * - `estado`: el reproductor de quien lo manda acaba de cambiar (play, pausa o
 *   salto) o es el pulso periódico del anfitrión. Lleva el estado entero y no
 *   solo la orden: así da igual si se perdió el anterior.
 * - `hola`: alguien acaba de entrar y pide el estado y la película.
 * - `video`: la película de la sala, con su versión (ver `PeliculaDeSala`).
 * - `empezar`: alguien pulsó «Empezar»: cuenta atrás en todos y a reproducir.
 *
 * Sin hora de envío: la versión anterior compensaba la latencia con
 * `Date.now()` del otro aparato, y el reloj de un televisor puede ir minutos
 * desviado. La latencia real de Pusher (décimas) cabe de sobra en la
 * tolerancia.
 */
export type MensajeSala =
  | { tipo: "estado"; tiempo: number; pausado: boolean; pulso?: boolean }
  | { tipo: "hola" }
  | { tipo: "video"; pelicula: PeliculaDeSala }
  | { tipo: "empezar" };

/** Lo que llega por la red, comprobado: un mensaje mal formado se ignora. */
export function leerMensaje(dato: unknown): MensajeSala | null {
  if (!dato || typeof dato !== "object") return null;
  const m = dato as Record<string, unknown>;
  if (m.tipo === "hola") return { tipo: "hola" };
  if (m.tipo === "estado") {
    if (typeof m.tiempo !== "number" || !Number.isFinite(m.tiempo) || m.tiempo < 0) return null;
    if (typeof m.pausado !== "boolean") return null;
    return { tipo: "estado", tiempo: m.tiempo, pausado: m.pausado, pulso: m.pulso === true };
  }
  if (m.tipo === "empezar") return { tipo: "empezar" };
  if (m.tipo === "video") {
    const p = m.pelicula as Record<string, unknown> | undefined;
    if (!p || typeof p !== "object") return null;
    const version = p.version;
    if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return null;
    if (typeof p.por !== "string" || !p.por || p.por.length > 64) return null;
    const v = p.video as Record<string, unknown> | undefined;
    // Solo http(s): esta URL acaba en el `src` de un `<video>` de otro aparato.
    if (!v || typeof v.url !== "string" || !/^https?:\/\//i.test(v.url)) return null;
    const titulo = typeof v.titulo === "string" ? v.titulo.slice(0, 200) : "";
    const subtitulos = leerSubtitulos(v.subtitulos);
    return {
      tipo: "video",
      pelicula: {
        video: subtitulos.length > 0 ? { url: v.url, titulo, subtitulos } : { url: v.url, titulo },
        version,
        por: p.por,
      },
    };
  }
  return null;
}
