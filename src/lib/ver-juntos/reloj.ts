/**
 * El reloj de sala: «sincronía suave» para lo que no se puede mandar.
 *
 * El reproductor de Vimeus vive en un iframe de otro dominio y no acepta
 * órdenes (ver `docs/VIMEUS-JUNTOS.md`): no se le puede decir «pausa» ni
 * preguntar por dónde va. Lo que sí se puede compartir es **la hora de la
 * película**: todos dan play a la vez tras una cuenta atrás, y la sala lleva
 * la cuenta de por dónde deberían ir. Cada persona pausa o corrige su propio
 * reproductor a mano; la sala solo dice cuándo y dónde.
 *
 * Sin relojes de pared: cada aparato cuenta con su propio cronómetro
 * (`performance.now()`), y quien dirige re-ancla a los demás con su pulso. El
 * de una tele puede ir minutos desviado.
 *
 * Funciones puras, sin React ni red.
 */

export interface Reloj {
  /** Segundos de película cuando se ancló. */
  base: number;
  /** Cronómetro local (ms) en el momento de anclar; `null` = en pausa. */
  desde: number | null;
}

export const RELOJ_PARADO: Reloj = { base: 0, desde: null };

/** Por dónde deberían ir ahora, en segundos. */
export function leerReloj(reloj: Reloj, ahora: number): number {
  return reloj.desde === null ? reloj.base : reloj.base + Math.max(0, ahora - reloj.desde) / 1000;
}

export function relojEn(tiempo: number, pausado: boolean, ahora: number): Reloj {
  return { base: Math.max(0, tiempo), desde: pausado ? null : ahora };
}

export const pausarReloj = (reloj: Reloj, ahora: number): Reloj => relojEn(leerReloj(reloj, ahora), true, ahora);
export const reanudarReloj = (reloj: Reloj, ahora: number): Reloj => relojEn(leerReloj(reloj, ahora), false, ahora);

/**
 * ¿Hay que re-anclar con lo que dice quien dirige? Solo si la diferencia se
 * nota: el pulso llega con décimas de retraso y corregir por eso haría bailar
 * los segundos en pantalla.
 */
export function hayQueCorregir(reloj: Reloj, tiempo: number, pausado: boolean, ahora: number): boolean {
  if ((reloj.desde === null) !== pausado) return true;
  return Math.abs(leerReloj(reloj, ahora) - tiempo) > 1.5;
}

/** «12:34» o «1:02:03» escrito por una persona → segundos; `null` si no se entiende. */
export function leerMinuto(texto: string): number | null {
  const partes = texto.trim().split(/[:.\s]+/).filter(Boolean);
  if (partes.length === 0 || partes.length > 3 || partes.some((p) => !/^\d{1,3}$/.test(p))) return null;
  const n = partes.map(Number);
  // Un número solo son minutos: «voy por el 47».
  if (n.length === 1) return n[0]! * 60;
  if (n.slice(1).some((x) => x > 59)) return null;
  return n.length === 2 ? n[0]! * 60 + n[1]! : n[0]! * 3600 + n[1]! * 60 + n[2]!;
}

/** Qué título tiene puesto alguien de la sala, para que el otro abra el mismo. */
export interface TituloDeSala {
  /** La ruta de la ficha, con su episodio: siempre de esta misma app. */
  ruta: string;
  nombre: string;
}

/**
 * Lo que viaja por la sala en sincronía suave. Va por un evento DISTINTO del
 * de «Nuestras películas» (`client-reloj`): si alguien de la misma sala
 * estuviera en Mi enlace, estos mensajes no deben tocarle el vídeo.
 */
export type MensajeReloj =
  | { tipo: "hola" }
  | { tipo: "listo"; listo: boolean }
  | { tipo: "empezar" }
  | { tipo: "reloj"; tiempo: number; pausado: boolean; pulso?: boolean }
  | { tipo: "titulo"; titulo: TituloDeSala };

/** Lo que llega por la red, comprobado: un mensaje mal formado se ignora. */
export function leerMensajeReloj(dato: unknown): MensajeReloj | null {
  if (!dato || typeof dato !== "object") return null;
  const m = dato as Record<string, unknown>;
  if (m.tipo === "hola") return { tipo: "hola" };
  if (m.tipo === "empezar") return { tipo: "empezar" };
  if (m.tipo === "listo") return typeof m.listo === "boolean" ? { tipo: "listo", listo: m.listo } : null;
  if (m.tipo === "reloj") {
    if (typeof m.tiempo !== "number" || !Number.isFinite(m.tiempo) || m.tiempo < 0 || m.tiempo > 86_400) return null;
    if (typeof m.pausado !== "boolean") return null;
    return { tipo: "reloj", tiempo: m.tiempo, pausado: m.pausado, pulso: m.pulso === true };
  }
  if (m.tipo === "titulo") {
    const t = m.titulo as Record<string, unknown> | undefined;
    // Solo rutas de ficha de esta app: acaba en un enlace que otra persona pulsa.
    if (!t || typeof t.ruta !== "string" || !/^\/peliculas\/(movie|tv)\/[a-z0-9-]{1,60}(\?t=\d{1,3})?$/i.test(t.ruta)) return null;
    return { tipo: "titulo", titulo: { ruta: t.ruta, nombre: typeof t.nombre === "string" ? t.nombre.slice(0, 200) : "" } };
  }
  return null;
}
