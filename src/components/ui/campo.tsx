"use client";

import { useId, useRef, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { Search, X } from "lucide-react";
import { unir, type Tamano } from "./clases";

/**
 * Un campo de texto: píldora con icono, el `<input>` y, si se pide, un aspa
 * para vaciarlo y una acción al final (el micrófono de Buscar).
 *
 * Tres cosas que los cinco campos de antes resolvían cada uno a su manera, o
 * no resolvían:
 *
 * - **El foco se ve en la píldora**, con `:focus-within`, y no en el input:
 *   un anillo alrededor del texto suelto, dentro de una píldora, se lee como
 *   un fallo de pintado. Dos campos (`.livetv-search`, `.fuente-nombre`) no
 *   cambiaban nada al enfocarse: con el mando no había forma de saber que el
 *   foco estaba ahí.
 * - **Encoge.** `min-width: 0` en la píldora y en el input: el de Buscar se
 *   quedaba en 361 px fijos y se salía de la pantalla en un Android de 360.
 * - **La etiqueta se ve.** El texto de ayuda dentro del campo desaparece al
 *   escribir, y a una persona mayor no le queda nada que le diga qué era.
 *   Con `etiquetaOculta` se queda solo para el lector (Buscar, donde la lupa
 *   y el contexto ya lo dicen).
 */

type CampoProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  /** Lo que se pide. Se pinta encima salvo con `etiquetaOculta`. */
  etiqueta: string;
  etiquetaOculta?: boolean;
  icono?: ReactNode;
  /** Muestra un aspa cuando hay texto. Requiere `onLimpiar`. */
  limpiable?: boolean;
  onLimpiar?: () => void;
  /** Un control al final de la píldora (micrófono, «Pegar»…). */
  accionFinal?: ReactNode;
  /** Texto bajo el campo: una pista o, con `invalido`, el error. */
  ayuda?: ReactNode;
  invalido?: boolean;
  tamano?: Tamano;
  /** Clases para el envoltorio (la etiqueta + la píldora). */
  className?: string;
  ref?: Ref<HTMLInputElement>;
};

export function Campo({
  etiqueta,
  etiquetaOculta,
  icono,
  limpiable,
  onLimpiar,
  accionFinal,
  ayuda,
  invalido,
  tamano = "md",
  className,
  id,
  ref,
  ...input
}: CampoProps) {
  const idPropio = useId();
  const idCampo = id ?? `campo-${idPropio}`;
  const idAyuda = `${idCampo}-ayuda`;
  const interno = useRef<HTMLInputElement | null>(null);

  const hayTexto = String(input.value ?? "").length > 0;

  // El `ref` de fuera y el propio, a la vez: el aspa necesita devolver el
  // foco al campo, y quien usa el componente puede querer enfocarlo también.
  const enlazarRef = (nodo: HTMLInputElement | null) => {
    interno.current = nodo;
    if (typeof ref === "function") ref(nodo);
    else if (ref) ref.current = nodo;
  };

  return (
    <div className={unir("ui-campo-envoltorio", className)}>
      <label htmlFor={idCampo} className={etiquetaOculta ? "ui-solo-lector" : "ui-campo-etiqueta"}>
        {etiqueta}
      </label>
      <div className="ui ui-campo" data-tamano={tamano} data-invalido={invalido || undefined}>
        {icono && (
          <span className="ui-campo-icono" aria-hidden="true">
            {icono}
          </span>
        )}
        <input
          data-nav="input"
          {...input}
          ref={enlazarRef}
          id={idCampo}
          className="ui-campo-input"
          aria-invalid={invalido || undefined}
          aria-describedby={ayuda ? idAyuda : input["aria-describedby"]}
        />
        {limpiable && hayTexto && onLimpiar && (
          <button
            type="button"
            data-nav="button"
            className="ui ui-campo-limpiar"
            aria-label={`Borrar ${etiqueta.toLowerCase()}`}
            onClick={() => {
              onLimpiar();
              interno.current?.focus();
            }}
          >
            <X aria-hidden="true" />
          </button>
        )}
        {accionFinal}
      </div>
      {ayuda && (
        <p id={idAyuda} className="ui-campo-ayuda" data-invalido={invalido || undefined}>
          {ayuda}
        </p>
      )}
    </div>
  );
}

/**
 * El campo de buscar: lupa, `type="search"`, «Buscar» en el teclado del
 * teléfono y el aspa puesta por defecto. La etiqueta va oculta porque la lupa
 * ya lo dice, pero sigue ahí para el lector.
 */
export function CampoBusqueda({
  etiqueta = "Buscar",
  limpiable = true,
  etiquetaOculta = true,
  ...resto
}: Omit<CampoProps, "etiqueta" | "icono" | "type"> & { etiqueta?: string }) {
  return (
    <Campo
      type="search"
      enterKeyHint="search"
      autoComplete="off"
      spellCheck={false}
      {...resto}
      etiqueta={etiqueta}
      etiquetaOculta={etiquetaOculta}
      limpiable={limpiable}
      icono={<Search />}
    />
  );
}
