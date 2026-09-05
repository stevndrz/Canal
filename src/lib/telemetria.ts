/**
 * Cómo se escriben los datos de la emisión en el reproductor.
 *
 * El lenguaje es el de una sala de control: etiqueta corta, valor de ancho
 * fijo, y **ningún módulo que no tenga un dato de verdad detrás**. Si no se
 * sabe el bitrate no se enseña un guion ni un cero: no se enseña el módulo.
 * Un panel que miente es peor que uno con un hueco.
 *
 * Aquí solo vive el formato, sin DOM ni React, para poder probarlo.
 */

/** Un módulo del panel: etiqueta arriba, valor abajo. */
export interface Dato {
  etiqueta: string;
  valor: string;
}

/**
 * El nombre corriente de una resolución.
 *
 * «1080p» dice más que «1920 × 1080» a tres metros, y sobre todo se lee de un
 * vistazo. Se clasifica por ALTURA porque el ancho varía con la proporción:
 * muchos canales emiten 1440×1080 o 1280×720 recortado, y por ancho saldrían
 * mal clasificados.
 */
export function nombreDeResolucion(ancho?: number, alto?: number): string | null {
  if (!ancho || !alto) return null;
  if (alto >= 2000) return "4K";
  if (alto >= 1000) return "1080p";
  if (alto >= 700) return "720p";
  if (alto >= 540) return "576p";
  if (alto >= 400) return "480p";
  return `${alto}p`;
}

/**
 * Bits por segundo → lo que cabe en un módulo.
 *
 * Un decimal hasta 10 Mb/s y ninguno por encima: la diferencia entre 12,3 y
 * 12,4 no le importa a nadie, y un dígito que cambia sin parar en pantalla
 * distrae de lo que se está viendo.
 */
export function formatearBitrate(bitsPorSegundo?: number): string | null {
  if (!bitsPorSegundo || bitsPorSegundo <= 0) return null;
  const mega = bitsPorSegundo / 1_000_000;
  if (mega >= 10) return `${Math.round(mega)} Mb/s`;
  if (mega >= 1) return `${mega.toFixed(1).replace(".", ",")} Mb/s`;
  return `${Math.round(bitsPorSegundo / 1000)} kb/s`;
}

/**
 * Cuánto llevas en este canal, en formato de cuenta.
 *
 * `T+` es la convención de una cuenta desde un evento, que es exactamente lo
 * que es: el tiempo desde que se sintonizó. Horas solo cuando las hay.
 */
export function tiempoEnCanal(desdeMs: number, ahoraMs: number): string {
  const total = Math.max(0, Math.floor((ahoraMs - desdeMs) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const dos = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${dos(m)}:${dos(s)}`;
}

/** En qué está el reproductor, en una palabra. */
export type EstadoEmision = "vivo" | "pausa" | "sin-senal" | "sintonizando" | "emitiendo" | "buffering";

export function palabraDeEstado(estado: EstadoEmision): string {
  switch (estado) {
    case "sin-senal":
      return "SIN SEÑAL";
    case "pausa":
      return "PAUSA";
    case "sintonizando":
      return "SINTONIZANDO";
    case "buffering":
      return "CARGANDO";
    case "emitiendo":
      return "EMITIENDO";
    case "vivo":
      return "EN VIVO";
  }
}

/**
 * Milisegundos hasta el primer fotograma → lo que cabe en un módulo.
 *
 * Por debajo de un segundo se dice en ms (850 ms dice más que 0,8 s cuando se
 * compara zapeo); por encima, en segundos con un decimal y coma.
 */
export function formatearTtff(ms?: number): string | null {
  if (ms === undefined || ms === null || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

export interface LecturaEmision {
  ancho?: number;
  alto?: number;
  bitrate?: number;
  /** Cuándo se sintonizó este canal. */
  desde?: number;
  ahora?: number;
  /** Cortes de búfer desde que se sintonizó (eventos `waiting`). */
  stalls?: number;
  /** Fotogramas perdidos del `<video>` (solo donde hay decodificación). */
  caidos?: number;
  /** Tiempo hasta el primer fotograma, en ms. */
  ttffMs?: number;
}

/**
 * Los módulos que hay que pintar, y solo esos.
 *
 * **Un módulo sin dato no existe.** Con mpegts.js o con el HLS nativo de
 * Safari no hay bitrate que leer, así que ese módulo simplemente no sale, en
 * vez de dejar un hueco con un guion que parece un fallo.
 */
export function modulosDeEmision(lectura: LecturaEmision): Dato[] {
  const modulos: Dato[] = [];

  const resolucion = nombreDeResolucion(lectura.ancho, lectura.alto);
  if (resolucion) modulos.push({ etiqueta: "Señal", valor: resolucion });

  const bitrate = formatearBitrate(lectura.bitrate);
  if (bitrate) modulos.push({ etiqueta: "Tasa", valor: bitrate });

  // Cortes y arranque solo cuando dicen algo: cero cortes no es información y
  // un TTFF ausente (HLS nativo sin marca) no es un hueco que parezca un fallo.
  if (lectura.stalls !== undefined && lectura.stalls > 0) {
    modulos.push({ etiqueta: "Cortes", valor: String(lectura.stalls) });
  }
  const ttff = formatearTtff(lectura.ttffMs);
  if (ttff) modulos.push({ etiqueta: "Arranque", valor: ttff });

  // Presencia, no verdad: el primer instante de una sesión es `0` y un `0`
  // falsy borraría el módulo justo al sintonizar, que es cuando más se mira.
  if (lectura.desde !== undefined && lectura.ahora !== undefined) {
    modulos.push({ etiqueta: "En canal", valor: `T+ ${tiempoEnCanal(lectura.desde, lectura.ahora)}` });
  }

  return modulos;
}
