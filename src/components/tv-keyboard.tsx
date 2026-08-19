"use client";

import { Delete } from "lucide-react";

const ROWS = ["ABCDEFG", "HIJKLMN", "OPQRSTU", "VWXYZÑ", "01234", "56789"];

interface TvKeyboardProps {
  onKey: (char: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}

/**
 * Teclado en pantalla para el mando. Las teclas son cuadradas y fluidas
 * (min 44px), así que la cuadrícula nunca desborda sobre los resultados.
 */
export function TvKeyboard({ onKey, onBackspace, onClear }: TvKeyboardProps) {
  const keyClass =
    "grid aspect-square min-h-[48px] min-w-[44px] flex-1 place-items-center rounded-[13px] border border-hairline bg-white/[0.06] text-lg font-medium text-zinc-200 focus:bg-accent focus:text-accent-on";

  const wideClass =
    "grid min-h-[48px] flex-[1_1_96px] place-items-center rounded-[13px] border border-hairline bg-white/[0.06] px-4 text-[15px] font-medium text-zinc-200 focus:bg-accent focus:text-accent-on";

  return (
    <div className="flex flex-col gap-2">
      {ROWS.map((row) => (
        <div key={row} className="flex min-w-0 flex-wrap gap-2">
          {row.split("").map((char) => (
            <button
              key={char}
              type="button"
              data-nav="key"
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
          <Delete aria-hidden="true" strokeWidth={1.5} className="h-[19px] w-[19px]" />
        </button>
        <button type="button" data-nav="key" onClick={onClear} className={wideClass}>
          Borrar todo
        </button>
      </div>
    </div>
  );
}
