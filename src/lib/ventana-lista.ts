/**
 * Qué filas de una lista larga hace falta montar de verdad.
 *
 * El problema medido: la lista de canales pintaba por lotes de 60 y el lote
 * **solo crecía**. Bajando hasta el final de «Todas» se acababan montando los
 * 7.822 canales — unos 141.000 nodos y **15.650 elementos `[data-nav]`**. Y eso
 * no solo pesa: `use-spatial-nav` recorre todos los `[data-nav]` llamando a
 * `getBoundingClientRect()` **en cada pulsación de flecha del mando**. Cada
 * tecla se convertía en quince mil medidas de maquetación.
 *
 * `content-visibility` no vale como respuesta aquí, aunque `shell.css` la
 * llame «la mayor ganancia de todo el archivo»: necesita Chromium 85 y el
 * parque objetivo va de Chromium 53 (webOS 4) a 79 (webOS 6). Nunca estuvo
 * corriendo en las teles a las que apunta esta app. La ventana hay que
 * calcularla en JavaScript.
 *
 * Aquí solo vive la aritmética, sin DOM ni React, para poder probarla.
 */

/** Filas de más que se montan por arriba y por abajo de lo estrictamente visible. */
export const HOLGURA = 12;

export interface Ventana {
  /** Primer índice montado. */
  desde: number;
  /** Primer índice YA NO montado (exclusivo), al estilo de `slice`. */
  hasta: number;
  /** Alto en píxeles del hueco de arriba, para que la barra no salte. */
  huecoArriba: number;
  /** Alto en píxeles del hueco de abajo. */
  huecoAbajo: number;
}

export interface MedidasLista {
  /** Cuánto ha bajado la ventana. */
  desplazamiento: number;
  /** Alto visible de la ventana. */
  alto: number;
  /** Dónde empieza la lista respecto al principio del documento. */
  inicioLista: number;
  /** Alto de una fila, hueco incluido. */
  altoFila: number;
  /** Cuántas filas hay en total. */
  total: number;
  /** Filas de margen; se deja abierto para las pruebas. */
  holgura?: number;
}

/**
 * La ventana a montar.
 *
 * **La holgura es lo que hace que esto sea usable con un mando.** Sin ella, la
 * fila justo debajo del borde no existiría en el DOM, así que el foco no
 * podría saltar a ella y la navegación se quedaría clavada en el último
 * elemento visible. Con doce filas de margen a cada lado, el mando siempre
 * tiene a dónde ir antes de que el desplazamiento monte las siguientes.
 */
export function calcularVentana({
  desplazamiento,
  alto,
  inicioLista,
  altoFila,
  total,
  holgura = HOLGURA,
}: MedidasLista): Ventana {
  // Sin una altura de fila creíble no se puede dividir: se monta todo, que es
  // exactamente el comportamiento de antes. Pasa en el primer render, antes de
  // haber podido medir nada.
  if (!Number.isFinite(altoFila) || altoFila <= 0 || total <= 0) {
    return { desde: 0, hasta: total, huecoArriba: 0, huecoAbajo: 0 };
  }

  // Cuánto de la lista queda por encima del borde superior de la ventana.
  const recorrido = Math.max(0, desplazamiento - inicioLista);
  const primeraVisible = Math.floor(recorrido / altoFila);
  const cuantasCaben = Math.ceil(alto / altoFila);

  const desde = Math.max(0, primeraVisible - holgura);
  const hasta = Math.min(total, primeraVisible + cuantasCaben + holgura);

  return {
    desde,
    hasta,
    // Los huecos sustituyen a las filas que no se montan, para que la barra de
    // desplazamiento mida lo mismo que si estuvieran todas y no dé tirones.
    huecoArriba: desde * altoFila,
    huecoAbajo: Math.max(0, (total - hasta) * altoFila),
  };
}

/**
 * ¿Merece la pena volver a pintar?
 *
 * El evento de desplazamiento se dispara decenas de veces por segundo, y en un
 * televisor lento cada `setState` cuesta. Solo interesa cuando la ventana
 * cambia de verdad.
 */
export function ventanaCambio(anterior: Ventana, siguiente: Ventana): boolean {
  return anterior.desde !== siguiente.desde || anterior.hasta !== siguiente.hasta;
}
