/**
 * Las cuentas de la parrilla, sin DOM ni React para poder probarlas.
 *
 * Convertir instantes en porcentajes de una franja suena trivial; los tres
 * casos que no lo son están en las pruebas: el programa que ya había empezado
 * antes de la franja, el que se sale por la derecha, y los huecos de guía —que
 * hay que dibujar, o dos bloques pegados parecen seguidos.
 *
 * Devuelve porcentajes y no píxeles: la misma parrilla sirve en un teléfono y
 * en un televisor de 1920 sin recalcular nada.
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
 * Las guías encadenan 20:29:58 → 20:30:00; dibujar esos dos segundos deja
 * rendijas de un píxel que parecen un fallo de pintado.
 */
export const HUECO_MINIMO_MS = 60_000;

/**
 * Mismo margen que acepta `/api/guia` (`MARGEN_MS` en la ruta): no tiene
 * sentido dejar que los botones de la parrilla pidan una franja que el
 * servidor va a rechazar.
 */
export const MARGEN_FRANJA_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * La media hora en punto anterior a `ahora`. Empezar en «20:07» no se lee, y
 * una franja que se mueve sola hace bailar la parrilla bajo el foco del mando.
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
 * Los bloques suman siempre el 100% del ancho, y eso no es una curiosidad: es
 * lo que permite pintar la fila con `flex` en vez de con decenas de elementos
 * absolutos, bastante más barato en un televisor.
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
 * Se pregunta aparte y no se guarda en el bloque: el bloque se calcula una vez
 * y el «ahora» avanza. Guardarlo obligaría a rehacer la parrilla cada minuto.
 */
export function estaEnEmision(bloque: BloqueParrilla, ahora: number): boolean {
  return !bloque.hueco && bloque.inicio <= ahora && ahora < bloque.fin;
}

/**
 * Mueve el inicio de una franja un número de horas —negativo hacia atrás—,
 * sin salirse del margen que acepta `/api/guia`. Pura y probada aparte porque
 * es el único sitio donde se decide hasta dónde puede navegar la persona: un
 * error aquí deja botones que piden una franja que el servidor rechaza en
 * silencio, o un botón "anterior" que en el borde deja de moverse sin decir
 * por qué.
 */
export function moverFranja(desde: number, horas: number, ahora: number): number {
  const propuesta = desde + horas * 60 * 60 * 1000;
  const minimo = ahora - MARGEN_FRANJA_MS;
  const maximo = ahora + MARGEN_FRANJA_MS;
  return Math.min(maximo, Math.max(minimo, propuesta));
}
