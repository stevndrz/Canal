/**
 * Las cuentas de la parrilla, sin DOM ni React para poder probarlas.
 *
 * Una parrilla es una tabla donde el eje X es el tiempo, así que todo se
 * reduce a convertir instantes en porcentajes de una franja. Suena trivial y
 * tiene tres casos que no lo son, y son justo los que se ven en pantalla:
 *
 *  1. **El programa que ya había empezado.** A las 20:00 sigue emitiéndose lo
 *     que arrancó a las 19:30. Su bloque tiene que empezar pegado al borde
 *     izquierdo, no fuera de la pantalla ni en el minuto 30.
 *  2. **El que se sale por la derecha**, por lo mismo al revés.
 *  3. **Los huecos.** Casi ninguna guía XMLTV cubre las 24 horas de todos sus
 *     canales, y un hueco sin dibujar deja dos bloques pegados que parecen
 *     seguidos cuando no lo son. Un hueco tiene que verse como un hueco.
 *
 * Este archivo no sabe cuántos píxeles mide nada: devuelve porcentajes, y el
 * CSS decide el ancho. Es lo que permite que la misma parrilla sirva en un
 * teléfono y en un televisor de 1920 sin recalcular nada.
 */

/** Un programa ya colocado en la franja. */
export interface BloqueParrilla {
  titulo: string;
  /** Inicio real, para la hora que se enseña. Puede ser anterior a la franja. */
  inicio: number;
  fin: number;
  /** Desde la izquierda de la franja, en porcentaje. */
  izquierda: number;
  /** Ancho dentro de la franja, en porcentaje. */
  ancho: number;
  /** Venía de antes de la franja: se dibuja cortado por la izquierda. */
  cortadoAlInicio: boolean;
  /** Sigue después de la franja. */
  cortadoAlFinal: boolean;
  /** No es un programa, es una franja sin datos en la guía. */
  hueco?: true;
}

/** Lo mínimo de un programa para colocarlo. */
export interface ProgramaCrudo {
  titulo: string;
  inicio: number;
  fin: number;
}

/** Cuánto abarca la parrilla de una vez. Tres horas caben y se leen. */
export const HORAS_VISIBLES = 3;

/** El ancho de una columna de la cabecera: media hora. */
export const PASO_MINUTOS = 30;

/**
 * Un hueco más corto que esto no se dibuja.
 *
 * Las guías traen desajustes de segundos entre el fin de un programa y el
 * inicio del siguiente. Dibujarlos produce rendijas de un píxel que parecen un
 * fallo de pintado, y en un televisor se ven como parpadeos en el borde.
 */
export const HUECO_MINIMO_MS = 60_000;

/**
 * El inicio de la franja: la media hora en punto anterior a `ahora`.
 *
 * Empezar exactamente en `ahora` haría que la primera columna fuera «20:07»,
 * que no se lee. Y que la franja se mueva sola cada minuto es peor: la parrilla
 * bailaría bajo el foco del mando mientras alguien la recorre.
 */
export function inicioDeFranja(ahora: number, pasoMinutos = PASO_MINUTOS): number {
  const paso = pasoMinutos * 60_000;
  return Math.floor(ahora / paso) * paso;
}

/** Las marcas de la cabecera: una por cada paso de la franja. */
export function columnasDeFranja(
  desde: number,
  horas = HORAS_VISIBLES,
  pasoMinutos = PASO_MINUTOS,
): number[] {
  const cuantas = Math.round((horas * 60) / pasoMinutos);
  return Array.from({ length: cuantas }, (_, i) => desde + i * pasoMinutos * 60_000);
}

/** Dónde cae un instante dentro de la franja, de 0 a 100. */
export function posicionEnFranja(instante: number, desde: number, hasta: number): number {
  if (hasta <= desde) return 0;
  return Math.min(100, Math.max(0, ((instante - desde) / (hasta - desde)) * 100));
}

/**
 * Coloca los programas de un canal en la franja, rellenando los huecos.
 *
 * Devuelve una fila completa de extremo a extremo: los bloques suman siempre el
 * 100% del ancho, con huecos donde la guía no dice nada. Eso es lo que permite
 * que la fila se pinte con un `flex` sin posicionamiento absoluto, que es
 * bastante más barato en un televisor.
 */
export function filaDeParrilla(
  programas: ProgramaCrudo[],
  desde: number,
  hasta: number,
): BloqueParrilla[] {
  if (hasta <= desde) return [];

  const dentro = programas
    .filter((p) => p.fin > desde && p.inicio < hasta && p.fin > p.inicio)
    .sort((a, b) => a.inicio - b.inicio);

  const bloques: BloqueParrilla[] = [];
  let cursor = desde;

  const hueco = (inicio: number, fin: number) => {
    if (fin - inicio < HUECO_MINIMO_MS) return;
    bloques.push({
      titulo: "",
      inicio,
      fin,
      izquierda: posicionEnFranja(inicio, desde, hasta),
      ancho: posicionEnFranja(fin, desde, hasta) - posicionEnFranja(inicio, desde, hasta),
      cortadoAlInicio: false,
      cortadoAlFinal: false,
      hueco: true,
    });
  };

  for (const programa of dentro) {
    // Guías con programas solapados: se ignora lo que ya quedó cubierto en vez
    // de dibujar bloques encima. Pasa en las guías agregadas de varias fuentes.
    if (programa.fin <= cursor) continue;

    const inicioVisible = Math.max(programa.inicio, cursor);
    if (inicioVisible > cursor) hueco(cursor, inicioVisible);

    const finVisible = Math.min(programa.fin, hasta);
    const izquierda = posicionEnFranja(inicioVisible, desde, hasta);
    bloques.push({
      titulo: programa.titulo,
      inicio: programa.inicio,
      fin: programa.fin,
      izquierda,
      ancho: posicionEnFranja(finVisible, desde, hasta) - izquierda,
      cortadoAlInicio: programa.inicio < desde,
      cortadoAlFinal: programa.fin > hasta,
    });
    cursor = finVisible;
    if (cursor >= hasta) break;
  }

  if (cursor < hasta) hueco(cursor, hasta);
  return bloques;
}

/**
 * ¿Está sonando ahora este bloque?
 *
 * Se pregunta aparte y no se guarda en el bloque a propósito: el bloque se
 * calcula una vez y el «ahora» avanza. Guardarlo obligaría a recalcular la
 * parrilla entera cada minuto, que es justo lo que no se puede hacer con 7.822
 * canales detrás.
 */
export function estaEnEmision(bloque: BloqueParrilla, ahora: number): boolean {
  return !bloque.hueco && bloque.inicio <= ahora && ahora < bloque.fin;
}
