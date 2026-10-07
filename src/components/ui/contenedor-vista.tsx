import type { HTMLAttributes, ReactNode } from "react";
import { unir } from "./clases";

/**
 * El margen de una vista: `--margen` a los lados **a todos los anchos**.
 *
 * «Un solo margen» es uno de los principios de la app, y cada vista lo
 * aplicaba a su manera: «Mi enlace» tocaba los dos bordes de la pantalla
 * hasta 1.100 px porque solo limitaba el ancho, y Ajustes, entre 681 y
 * 880 px, porque el margen solo se ponía en el teléfono. Aquí el margen va
 * siempre, y el ancho máximo se suma por dentro de él.
 *
 * - **completo**: todo el ancho (rieles, rejillas).
 * - **medio**: 1.100 px de contenido (formularios con lista, Mi enlace).
 * - **lectura**: 880 px, una columna cómoda de leer (Ajustes).
 */

type ContenedorVistaProps = HTMLAttributes<HTMLDivElement> & {
  ancho?: "completo" | "medio" | "lectura";
  children?: ReactNode;
};

export function ContenedorVista({ ancho = "completo", className, children, ...resto }: ContenedorVistaProps) {
  return (
    <div {...resto} className={unir("ui-contenedor", className)} data-ancho={ancho}>
      {children}
    </div>
  );
}
