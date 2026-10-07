import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { unir } from "./clases";

/**
 * Chip: un filtro o una categoría que se enciende y se apaga.
 *
 * «Activo» se pinta con el acento (relleno) y el foco con el anillo blanco:
 * son dos realces distintos a propósito, para que con el mando se sepa a la
 * vez qué está elegido y dónde está uno.
 *
 * El estado va en ARIA:
 * - Como botón, `aria-pressed`: es un interruptor.
 * - Como enlace, `aria-current="true"` y **nunca `"page"`**: el panel de
 *   géneros busca `[aria-current='true']` para poner ahí el primer foco
 *   (`genero-panel.tsx`), y un chip con `"page"` lo dejaría sin destino.
 */

interface PropsComunes {
  activo?: boolean;
  icono?: ReactNode;
  /** Un número al lado (cuántos canales hay en esa categoría). */
  contador?: ReactNode;
  children: ReactNode;
}

type PropsChipBoton = PropsComunes &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof PropsComunes> & {
    href?: undefined;
    ref?: Ref<HTMLButtonElement>;
  };

type PropsChipEnlace = PropsComunes &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof PropsComunes | "href"> & {
    href: string;
    ref?: Ref<HTMLAnchorElement>;
    replace?: boolean;
    scroll?: boolean;
    prefetch?: boolean;
  };

export type ChipProps = PropsChipBoton | PropsChipEnlace;

function Contenido({ icono, contador, children }: Omit<PropsComunes, "activo">) {
  return (
    <>
      {icono && (
        <span className="ui-chip-icono" aria-hidden="true">
          {icono}
        </span>
      )}
      <span className="ui-chip-texto">{children}</span>
      {contador !== undefined && contador !== null && <span className="ui-chip-contador">{contador}</span>}
    </>
  );
}

export function Chip(props: ChipProps) {
  const { activo = false, icono, contador, className, children, ...resto } = props;
  const clases = unir("ui ui-chip", className);

  if (resto.href !== undefined) {
    const { href, ...enlace } = resto as Omit<PropsChipEnlace, keyof PropsComunes | "className">;
    return (
      <Link
        href={href}
        data-nav="button"
        {...enlace}
        className={clases}
        aria-current={activo ? "true" : undefined}
      >
        <Contenido icono={icono} contador={contador}>
          {children}
        </Contenido>
      </Link>
    );
  }

  const boton = resto as Omit<PropsChipBoton, keyof PropsComunes | "className">;
  return (
    <button type="button" data-nav="button" {...boton} className={clases} aria-pressed={activo}>
      <Contenido icono={icono} contador={contador}>
        {children}
      </Contenido>
    </button>
  );
}
