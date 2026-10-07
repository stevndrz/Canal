import type { HTMLAttributes, ReactNode } from "react";
import { unir } from "./clases";

/**
 * «Aquí no hay nada» o «algo salió mal», con una salida.
 *
 * Había seis estados vacíos distintos. Este pone las cuatro piezas siempre en
 * el mismo orden: icono, título, texto y acciones. Un estado vacío es lo que
 * se ve cuando algo va mal, que es justo cuando peor sienta que la app
 * parezca otra.
 *
 * Dos tallas:
 * - **seccion**: dentro de una vista, en el sitio de una lista vacía.
 * - **pantalla**: ocupa la ventana (404, error). Para esa, mejor
 *   `PantallaMensaje`, que además se encarga del mando.
 */

type EstadoVacioProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  /** Un icono de lucide ya pintado: `<Compass />`. */
  icono?: ReactNode;
  titulo: ReactNode;
  texto?: ReactNode;
  /** Botones (`Boton`), el principal primero. */
  acciones?: ReactNode;
  talla?: "seccion" | "pantalla";
  /** Nivel del título. Por defecto, `<h1>` en pantalla (es la página entera) y `<h3>` en sección. */
  nivel?: 1 | 2 | 3 | 4;
};

export function EstadoVacio({
  icono,
  titulo,
  texto,
  acciones,
  talla = "seccion",
  nivel,
  className,
  ...resto
}: EstadoVacioProps) {
  const Titulo = `h${nivel ?? (talla === "pantalla" ? 1 : 3)}` as const;
  return (
    <div {...resto} className={unir("ui-vacio", className)} data-talla={talla}>
      {icono && (
        <span className="ui-vacio-icono" aria-hidden="true">
          {icono}
        </span>
      )}
      <Titulo className="ui-vacio-titulo">{titulo}</Titulo>
      {texto && <p className="ui-vacio-texto">{texto}</p>}
      {acciones && <div className="ui-vacio-acciones">{acciones}</div>}
    </div>
  );
}
