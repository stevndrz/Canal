"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { unir, type Tamano } from "./clases";
import { indiceSiguiente } from "./teclas";

/**
 * Elegir una opción entre pocas, todas a la vista.
 *
 * Sustituye a los «botones que rotan» de Ajustes (Calidad, Imagen, Motor):
 * parecían una acción —el mismo aspecto que «Actualizar»— y para saber qué
 * opciones había que pulsarlos hasta dar la vuelta. Aquí se ven todas y la
 * elegida lleva el acento.
 *
 * Es un `radiogroup` de verdad, con una diferencia deliberada respecto al
 * patrón de radios de WAI-ARIA: **las flechas mueven el foco, no la
 * elección**. Elegir es OK (o clic). Con el mando, pasar por «Muy grande»
 * camino de otra opción no puede agrandar toda la app a mitad de camino, ni
 * cambiar la calidad del vídeo que se está viendo.
 *
 * Solo la opción elegida entra en el orden de Tab (`tabIndex` 0): con
 * teclado, un Tab entra al grupo y el siguiente sale, en vez de recorrer
 * todas. El mando no mira `tabIndex`: son `<button>` y los alcanza igual.
 */

export interface OpcionSegmentado<T extends string> {
  valor: T;
  etiqueta: ReactNode;
  /** Nombre para el lector cuando la etiqueta no es texto (un icono, una «A»). */
  nombre?: string;
  deshabilitada?: boolean;
}

interface SegmentadoProps<T extends string> {
  /** Nombre del grupo para el lector. Si hay un título visible, usa `aria-labelledby`. */
  etiqueta?: string;
  "aria-labelledby"?: string;
  opciones: readonly OpcionSegmentado<T>[];
  valor: T;
  onCambio: (valor: T) => void;
  tamano?: Tamano;
  /** Las opciones se reparten todo el ancho disponible. */
  anchoCompleto?: boolean;
  className?: string;
  id?: string;
}

export function Segmentado<T extends string>({
  etiqueta,
  opciones,
  valor,
  onCambio,
  tamano = "md",
  anchoCompleto,
  className,
  id,
  ...aria
}: SegmentadoProps<T>) {
  const grupo = useRef<HTMLDivElement>(null);

  const alPulsarTecla = (evento: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const destino = indiceSiguiente(indice, opciones.length, evento.key);
    // En el borde (o con ↑/↓) la flecha no es nuestra: sigue su camino hasta
    // `use-spatial-nav`, que lleva el foco al control de al lado.
    if (destino === null) return;
    const botones = grupo.current?.querySelectorAll<HTMLButtonElement>("[role='radio']");
    const boton = botones?.[destino];
    if (!boton || boton.disabled) return;
    // Basta con `preventDefault`: el hook de navegación mira
    // `defaultPrevented` y no mueve el foco una segunda vez. Sin
    // `stopPropagation`, a propósito: `useRemoteInput` también escucha en
    // `window` y es quien pone `data-input="dpad"` (el anillo del mando).
    evento.preventDefault();
    boton.focus();
  };

  return (
    <div
      ref={grupo}
      id={id}
      role="radiogroup"
      aria-label={etiqueta}
      {...aria}
      className={unir("ui-segmentado", anchoCompleto && "is-ancho", className)}
      data-tamano={tamano}
    >
      {opciones.map((opcion, indice) => {
        const elegida = opcion.valor === valor;
        return (
          <button
            key={opcion.valor}
            type="button"
            role="radio"
            data-nav="button"
            aria-checked={elegida}
            aria-label={opcion.nombre}
            tabIndex={elegida ? 0 : -1}
            disabled={opcion.deshabilitada}
            className="ui ui-segmento"
            onClick={() => {
              if (!elegida) onCambio(opcion.valor);
            }}
            onKeyDown={(evento) => alPulsarTecla(evento, indice)}
          >
            {opcion.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
