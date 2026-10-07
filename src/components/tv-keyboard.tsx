"use client";

import { Delete } from "lucide-react";

const ROWS = ["ABCDEFG", "HIJKLMN", "OPQRSTU", "VWXYZÑ", "01234", "56789"];

interface TvKeyboardProps {
  onKey: (char: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  /**
   * La tecla «A» es la entrada de la vista (`data-nav-entrada`): al llegar con
   * el mando, el foco cae en el teclado y no en un campo de texto que, en la
   * tele, no se puede escribir. Ver `buscar-view.tsx`.
   */
  entrada?: boolean;
}

/**
 * Las piezas de cada tecla, con los tokens de la paleta: relleno sutil en
 * reposo y el blanco del FOCO al enfocarla (con la tinta del fondo encima),
 * que es lo que se ve desde el sofá. Ninguna tecla está «elegida», así que el
 * acento no aparece aquí. Sin transición de color: solo se anima opacidad o
 * transformación, y el blanco tiene que estar ya en la tecla al soltar la
 * flecha, no llegar un instante después.
 */
const BASE =
  "grid min-h-12 place-items-center rounded-[var(--radio-md)] border border-[var(--borde-sutil)] bg-relleno font-medium text-tinta-2 hover:bg-[var(--relleno-hover)] hover:text-tinta-1 focus:bg-[var(--foco)] focus:text-fondo";

/**
 * Teclado en pantalla para el mando. Las teclas son cuadradas y fluidas
 * (mínimo 48 px de alto y 44 de ancho), así que la cuadrícula nunca desborda
 * sobre los resultados.
 */
export function TvKeyboard({ onKey, onBackspace, onClear, entrada = false }: TvKeyboardProps) {
  const keyClass = `${BASE} aspect-square min-w-11 flex-1 text-lg`;
  const wideClass = `${BASE} flex-[1_1_96px] px-4 text-sm`;

  return (
    <div className="flex flex-col gap-2">
      {ROWS.map((row) => (
        <div key={row} className="flex min-w-0 flex-wrap gap-2">
          {row.split("").map((char) => (
            <button
              key={char}
              type="button"
              data-nav="key"
              data-nav-entrada={entrada && char === "A" ? "" : undefined}
              onClick={() => onKey(char)}
              className={keyClass}
            >
              {char}
            </button>
          ))}
        </div>
      ))}

      <div className="mt-1.5 flex gap-2">
        <button type="button" data-nav="key" onClick={() => onKey(" ")} className={wideClass}>
          Espacio
        </button>
        <button
          type="button"
          data-nav="key"
          aria-label="Borrar un carácter"
          onClick={onBackspace}
          className={keyClass}
        >
          <Delete aria-hidden="true" strokeWidth={1.5} className="h-[1.2em] w-[1.2em]" />
        </button>
        <button type="button" data-nav="key" onClick={onClear} className={wideClass}>
          Borrar todo
        </button>
      </div>
    </div>
  );
}
