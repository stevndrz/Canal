import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { unir, type Tamano } from "./clases";

/**
 * El botón de la app. Uno solo para los cinco papeles que había repartidos en
 * 36 recetas (`.primary`, `.secondary`, `buttonClass`, `.fuente-anadir`…).
 *
 * - **primario**: la acción de la pantalla. Relleno de acento. Uno por vista.
 * - **secundario**: el resto de acciones. Relleno translúcido.
 * - **fantasma**: acciones de poco peso (cerrar, «ver más»). Sin relleno.
 * - **peligro**: lo que borra. Rojo y nunca de un solo toque si no se puede
 *   deshacer: para eso está `Confirmacion`.
 *
 * El estado va en ARIA y no en clases (`aria-pressed`, `disabled`): así lo
 * que lee un lector de pantalla y lo que se pinta no pueden contradecirse.
 * Con `href` pinta un `<Link>`: un enlace que parece botón sigue siendo un
 * enlace (abre en otra pestaña, se copia), y OK lo activa igual.
 */

export type VarianteBoton = "primario" | "secundario" | "fantasma" | "peligro";

interface PropsComunes {
  variante?: VarianteBoton;
  tamano?: Tamano;
  /** Icono delante del texto (un `<Svg />` de lucide). Se oculta al lector. */
  icono?: ReactNode;
  /** Icono detrás del texto (una flecha, un desplegable). */
  iconoFinal?: ReactNode;
  /** Ocupa todo el ancho: el botón principal de un formulario en el teléfono. */
  anchoCompleto?: boolean;
  children?: ReactNode;
}

type PropsBotonNativo = PropsComunes &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof PropsComunes> & {
    href?: undefined;
    ref?: Ref<HTMLButtonElement>;
  };

type PropsEnlace = PropsComunes &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof PropsComunes | "href"> & {
    href: string;
    ref?: Ref<HTMLAnchorElement>;
    replace?: boolean;
    scroll?: boolean;
    prefetch?: boolean;
  };

export type BotonProps = PropsBotonNativo | PropsEnlace;

function Contenido({ icono, iconoFinal, children }: Pick<PropsComunes, "icono" | "iconoFinal" | "children">) {
  return (
    <>
      {icono && (
        <span className="ui-boton-icono" aria-hidden="true">
          {icono}
        </span>
      )}
      {children !== undefined && children !== null && <span className="ui-boton-texto">{children}</span>}
      {iconoFinal && (
        <span className="ui-boton-icono" aria-hidden="true">
          {iconoFinal}
        </span>
      )}
    </>
  );
}

export function Boton(props: BotonProps) {
  const {
    variante = "secundario",
    tamano = "md",
    icono,
    iconoFinal,
    anchoCompleto,
    className,
    children,
    ...resto
  } = props;
  const clases = unir("ui ui-boton", anchoCompleto && "is-ancho", className);

  if (resto.href !== undefined) {
    const { href, ...enlace } = resto as Omit<PropsEnlace, keyof PropsComunes | "className">;
    return (
      <Link
        href={href}
        data-nav="button"
        {...enlace}
        className={clases}
        data-variante={variante}
        data-tamano={tamano}
      >
        <Contenido icono={icono} iconoFinal={iconoFinal}>
          {children}
        </Contenido>
      </Link>
    );
  }

  const boton = resto as Omit<PropsBotonNativo, keyof PropsComunes | "className">;
  return (
    // `type="button"` por defecto: dentro de un <form>, un botón sin tipo es
    // «enviar» y un «Cancelar» mandaría el formulario.
    <button
      type="button"
      data-nav="button"
      {...boton}
      className={clases}
      data-variante={variante}
      data-tamano={tamano}
    >
      <Contenido icono={icono} iconoFinal={iconoFinal}>
        {children}
      </Contenido>
    </button>
  );
}

/**
 * Botón redondo de solo icono: cerrar, quitar, flechas, el engranaje.
 *
 * `aria-label` es obligatorio en el tipo y no opcional: un icono sin nombre es
 * un botón mudo para el lector de pantalla, y TypeScript no deja olvidarlo.
 */
type PropsBotonIcono = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label"> & {
  "aria-label": string;
  icono: ReactNode;
  variante?: VarianteBoton;
  tamano?: Tamano;
  ref?: Ref<HTMLButtonElement>;
};

export function BotonIcono({
  icono,
  variante = "secundario",
  tamano = "md",
  className,
  ...resto
}: PropsBotonIcono) {
  return (
    <button
      type="button"
      data-nav="button"
      {...resto}
      className={unir("ui ui-boton ui-boton-redondo", className)}
      data-variante={variante}
      data-tamano={tamano}
    >
      <span className="ui-boton-icono" aria-hidden="true">
        {icono}
      </span>
    </button>
  );
}
