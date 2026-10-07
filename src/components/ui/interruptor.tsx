import type { ButtonHTMLAttributes, Ref } from "react";
import { unir } from "./clases";

/**
 * Sí o no, como en Ajustes del iPhone.
 *
 * Es un `<button role="switch">` y no un `<input type="checkbox">`: OK del
 * mando activa un botón de forma nativa, y `use-spatial-nav` cuenta con eso
 * (no maneja OK por su cuenta).
 *
 * El pomo se centra con flexbox y se desplaza con `transform`, no con
 * `top`/`left` a mano: el anterior se colocaba con `top: 3px` dentro de una
 * pista de 42 px por dentro y quedaba a 3 px de arriba y 13 de abajo.
 * `transform` además no recalcula la maqueta en cada animación, que en una
 * tele de gama baja se nota.
 *
 * La pista visible es más baja que el botón: el área que se toca mide la
 * altura de control entera (48 px) aunque el dibujo sea más discreto.
 */
type InterruptorProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange" | "children"> & {
  activo: boolean;
  onCambio: (activo: boolean) => void;
  /** Nombre para el lector. Si hay un texto visible, mejor `aria-labelledby`. */
  etiqueta?: string;
  ref?: Ref<HTMLButtonElement>;
};

export function Interruptor({ activo, onCambio, etiqueta, className, onClick, ...resto }: InterruptorProps) {
  return (
    <button
      type="button"
      role="switch"
      data-nav="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      {...resto}
      className={unir("ui ui-interruptor", className)}
      onClick={(evento) => {
        onClick?.(evento);
        if (!evento.defaultPrevented) onCambio(!activo);
      }}
    >
      <span className="ui-interruptor-pista" aria-hidden="true">
        <span className="ui-interruptor-pomo" />
      </span>
    </button>
  );
}
