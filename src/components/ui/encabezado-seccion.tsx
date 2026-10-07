import type { HTMLAttributes, ReactNode } from "react";
import { unir } from "./clases";

/**
 * Título de una pantalla, de una sección o de un grupo de ajustes.
 *
 * Había 13 recetas de encabezado con seis interletrados distintos para las
 * versalitas. Aquí hay tres tallas con nombre:
 *
 * - **pagina**: el título de la vista («Ajustes», «Mi enlace»).
 * - **seccion**: un bloque dentro de la vista («Guardados en este
 *   dispositivo»). Opcionalmente con una acción a la derecha («Ver todo»).
 * - **grupo**: el rótulo pequeño en versalitas encima de una lista de ajustes
 *   («PANTALLA»). Es un título de verdad (`<h3>`), no un párrafo gris: el
 *   lector de pantalla salta de grupo en grupo con él.
 *
 * El nivel del `<h*>` va aparte de la talla: lo decide el esquema de la
 * página, no el tamaño que se quiere ver.
 */

type Nivel = 1 | 2 | 3 | 4;

type EncabezadoSeccionProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  titulo: ReactNode;
  /** Una línea encima del título que dice qué es esto. */
  sobretitulo?: ReactNode;
  /** Una línea debajo, para lo que no cabe en el título. */
  descripcion?: ReactNode;
  /** Un control a la derecha (un `Boton` fantasma, un enlace). */
  accion?: ReactNode;
  talla?: "pagina" | "seccion" | "grupo";
  nivel?: Nivel;
  /** Id del título, para que una lista o un grupo lo use en `aria-labelledby`. */
  idTitulo?: string;
};

const NIVEL_POR_TALLA = { pagina: 2, seccion: 2, grupo: 3 } as const;

export function EncabezadoSeccion({
  titulo,
  sobretitulo,
  descripcion,
  accion,
  talla = "seccion",
  nivel,
  idTitulo,
  className,
  ...resto
}: EncabezadoSeccionProps) {
  const Titulo = `h${nivel ?? NIVEL_POR_TALLA[talla]}` as const;
  return (
    <header {...resto} className={unir("ui-encabezado", className)} data-talla={talla}>
      <div className="ui-encabezado-textos">
        {sobretitulo && <p className="ui-sobretitulo">{sobretitulo}</p>}
        <Titulo id={idTitulo} className="ui-encabezado-titulo">
          {titulo}
        </Titulo>
        {descripcion && <p className="ui-encabezado-descripcion">{descripcion}</p>}
      </div>
      {accion && <div className="ui-encabezado-accion">{accion}</div>}
    </header>
  );
}
