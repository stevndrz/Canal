/**
 * Cuánto hay que mover las barras fijas del teléfono para que queden pegadas
 * a lo que de verdad se ve.
 *
 * Fallo de Safari en iOS 26 (Apple Developer Forums 800125, WebKit 300523):
 * tras abrir y cerrar el teclado —tocar «Buscar película o serie»—, el área
 * visible se queda desplazada dentro de la página (`visualViewport.offsetTop`
 * distinto de cero) y las barras `position: fixed`, que se anclan a la página
 * y no a lo visible, aparecen corridas: la de arriba a media pantalla y la de
 * abajo fuera. Lo vio el dueño en su iPhone.
 *
 * Una barra fija en lo alto de la página aparece en `-offsetTop` de lo
 * visible, así que basta con bajarla `offsetTop`. La de abajo, lo que falte
 * para que su borde coincida con el borde de abajo de lo visible.
 *
 * Sin React ni DOM, para probarlo.
 */
export interface MedidasViewport {
  /** `visualViewport.offsetTop` */
  offsetTop: number;
  /** `visualViewport.height` */
  height: number;
  /** `visualViewport.scale` */
  scale: number;
  /** `window.innerHeight` */
  innerHeight: number;
}

/** Más que esto de diferencia es el teclado abierto, no un desajuste. */
const TECLADO_PX = 150;

export function desfaseDeBarras(m: MedidasViewport): { arriba: number; abajo: number } {
  // Con zoom de pellizco las barras deben quedarse donde están: es la página
  // ampliada, no un fallo.
  if (Math.abs(m.scale - 1) > 0.01) return { arriba: 0, abajo: 0 };
  const arriba = Math.abs(m.offsetTop) < 1 ? 0 : Math.round(m.offsetTop);
  // Con el teclado abierto la barra de abajo se queda tras él, como siempre:
  // subirla encima del teclado taparía lo que se escribe.
  const tecladoAbierto = m.innerHeight - m.height > TECLADO_PX;
  const abajoBruto = m.offsetTop + m.height - m.innerHeight;
  const abajo = tecladoAbierto || Math.abs(abajoBruto) < 1 ? 0 : Math.round(abajoBruto);
  return { arriba, abajo };
}
