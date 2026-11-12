/**
 * Las cuentas de la guía interactiva del reproductor (la de pantalla completa,
 * como la de una caja de cable), sin DOM ni React para poder probarlas.
 *
 * Lo que la gobierna es un **cursor de tiempo**, no un índice de celda: al
 * subir o bajar de canal se queda el mismo instante y se elige el programa
 * que lo contiene en la fila nueva. Es lo que hace cualquier guía de cable, y
 * lo que evita que al bajar de un programa de las 20:00 se salte a uno de las
 * 18:30 solo porque es «el segundo de la fila».
 */

import { filaDeParrilla, inicioDeFranja, MARGEN_FRANJA_MS, PASO_MINUTOS, type BloqueParrilla, type ProgramaCrudo } from "./parrilla";

const PASO_MS = PASO_MINUTOS * 60_000;
const HORA_MS = 60 * 60_000;

/** Lo que dura la franja a la vista: dos horas en pantalla ancha, una en el teléfono. */
export function horasDeGuia(ancho: number): number {
  return ancho <= 680 ? 1 : 2;
}

/** Cuántas filas de canal caben: las que se leen desde el sofá, no las que caben apretadas. */
export function filasDeGuia(ancho: number, alto: number): number {
  if (alto < 520) return 3;
  if (ancho <= 680) return 5;
  return 6;
}

/**
 * Los bloques de una fila. Con un canal sin datos, la fila entera es un hueco
 * pulsable: también se puede ir a él desde la guía.
 */
export function bloquesDeFila(programas: readonly ProgramaCrudo[], desde: number, horas: number): BloqueParrilla[] {
  return filaDeParrilla([...programas], desde, desde + horas * HORA_MS);
}

/** Dónde empieza a verse un bloque: el real puede ser anterior a la franja. */
function inicioVisible(bloque: BloqueParrilla, desde: number): number {
  return Math.max(bloque.inicio, desde);
}

/** El bloque que contiene el instante, o el último si se pasa. */
export function indiceEn(bloques: readonly BloqueParrilla[], t: number, desde: number): number {
  if (bloques.length === 0) return -1;
  const i = bloques.findIndex((b) => inicioVisible(b, desde) <= t && t < b.fin);
  if (i !== -1) return i;
  return t < inicioVisible(bloques[0], desde) ? 0 : bloques.length - 1;
}

/**
 * El cursor tras pulsar ← o →: al principio del bloque anterior o siguiente.
 * Nunca antes de `ahora`: lo ya emitido no se puede ver.
 *
 * Un hueco largo (canal sin guía) se recorre de media hora en media hora: si
 * no, una fila vacía se saltaría de golpe dos horas.
 */
export function moverCursor(
  bloques: readonly BloqueParrilla[],
  t: number,
  delta: 1 | -1,
  desde: number,
  ahora: number,
): number {
  const minimo = ahora;
  const maximo = ahora + MARGEN_FRANJA_MS;
  const i = indiceEn(bloques, t, desde);
  const actual = bloques[i];
  if (!actual) return Math.min(maximo, Math.max(minimo, t + delta * PASO_MS));

  if (delta > 0) {
    const siguiente = actual.hueco ? Math.min(actual.fin, inicioDeFranja(t) + PASO_MS) : actual.fin;
    return Math.min(maximo, siguiente);
  }

  const empieza = inicioVisible(actual, desde);
  if (actual.hueco && t - PASO_MS >= empieza) return Math.max(minimo, inicioDeFranja(t - PASO_MS));
  // Ya está al principio de su bloque: al anterior. El que termina justo en
  // `empieza` es el que se pide; un instante antes cae dentro de él.
  const anterior = empieza - 1;
  if (anterior < minimo) return Math.max(minimo, Math.min(t, empieza));
  const previo = bloques[indiceEn(bloques, anterior, desde)];
  const destino = previo && inicioVisible(previo, desde) <= anterior ? inicioVisible(previo, desde) : anterior;
  return Math.max(minimo, destino);
}

/**
 * La franja que hay que enseñar para que el cursor se vea. Solo se mueve si
 * el cursor se sale: moverla en cada pulsación haría bailar la cabecera.
 */
export function franjaPara(desde: number, t: number, horas: number): number {
  const hasta = desde + horas * HORA_MS;
  return t >= desde && t < hasta ? desde : inicioDeFranja(t);
}

/**
 * Qué filas de canal se pintan: una ventana de `filas` alrededor del foco,
 * con el foco a un tercio desde arriba —el sitio donde una guía lo deja para
 * que se vea lo que viene debajo—.
 */
export function inicioDeVentana(total: number, foco: number, filas: number): number {
  if (total <= filas) return 0;
  const deseado = foco - Math.floor((filas - 1) / 3);
  return Math.max(0, Math.min(total - filas, deseado));
}

/** «1 h 19 min restantes», «Quedan 5 min», como se lee en una guía. */
export function textoRestante(fin: number, ahora: number): string {
  const minutos = Math.max(0, Math.ceil((fin - ahora) / 60_000));
  if (minutos < 60) return `Quedan ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `Quedan ${horas} h ${resto} min` : `Quedan ${horas} h`;
}

/**
 * Las secciones de zapeo en una sola lista para la guía, sin repetir canales
 * (la casa sale en «Mis canales» y otra vez en Guatemala), con el título de
 * la sección de cada uno para la cabecera.
 */
export function aplanarSecciones<T extends { id: number }>(
  secciones: readonly { titulo: string; canales: readonly T[] }[],
): { canales: T[]; seccionDe: string[] } {
  const vistos = new Set<number>();
  const canales: T[] = [];
  const seccionDe: string[] = [];
  for (const seccion of secciones) {
    for (const canal of seccion.canales) {
      if (vistos.has(canal.id)) continue;
      vistos.add(canal.id);
      canales.push(canal);
      seccionDe.push(seccion.titulo);
    }
  }
  return { canales, seccionDe };
}
