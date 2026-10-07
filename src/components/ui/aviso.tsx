import type { HTMLAttributes, ReactNode } from "react";
import { CircleCheck, Info, OctagonAlert, TriangleAlert, X } from "lucide-react";
import { Boton, BotonIcono } from "./boton";
import { unir } from "./clases";

/**
 * Un mensaje dentro de la página: información, algo que salió bien, algo a
 * tener en cuenta o un error.
 *
 * Había ocho avisos con cinco recetas, y dos amarillos distintos en la misma
 * caja (el token y su respaldo a mano). Aquí cada tono sale de un par de
 * tokens (`--aviso` + `--aviso-fondo`…) y **el color nunca va solo**: cada
 * tono lleva su icono, porque el rojo y el verde se confunden con la forma
 * más común de daltonismo.
 *
 * El texto va en `--tinta-1`, no en el color del tono: un párrafo entero en
 * amarillo sobre oscuro cansa y baja el contraste. El color está en el icono
 * y en el borde.
 *
 * Los errores se anuncian (`role="alert"`) y el resto se lee cuando toca
 * (`role="status"`).
 */

export type TonoAviso = "info" | "exito" | "aviso" | "peligro";

const ICONO: Record<TonoAviso, ReactNode> = {
  info: <Info />,
  exito: <CircleCheck />,
  aviso: <TriangleAlert />,
  peligro: <OctagonAlert />,
};

type AccionAviso =
  | { texto: string; onClick: () => void; href?: undefined }
  | { texto: string; href: string; onClick?: undefined };

type AvisoProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  tono?: TonoAviso;
  titulo?: ReactNode;
  children?: ReactNode;
  /** Un botón dentro del aviso: «Reintentar», «Deshacer», «Ver cómo». */
  accion?: AccionAviso;
  /** Si se pasa, sale un aspa para cerrarlo. */
  onCerrar?: () => void;
};

export function Aviso({ tono = "info", titulo, children, accion, onCerrar, className, ...resto }: AvisoProps) {
  return (
    <div
      role={tono === "peligro" ? "alert" : "status"}
      {...resto}
      className={unir("ui-aviso", className)}
      data-tono={tono}
    >
      <span className="ui-aviso-icono" aria-hidden="true">
        {ICONO[tono]}
      </span>
      <div className="ui-aviso-cuerpo">
        {titulo && <p className="ui-aviso-titulo">{titulo}</p>}
        {children && <div className="ui-aviso-texto">{children}</div>}
      </div>
      {(accion || onCerrar) && (
        <div className="ui-aviso-acciones">
          {accion &&
            (accion.href !== undefined ? (
              <Boton href={accion.href} variante="secundario" tamano="sm">
                {accion.texto}
              </Boton>
            ) : (
              <Boton variante="secundario" tamano="sm" onClick={accion.onClick}>
                {accion.texto}
              </Boton>
            ))}
          {onCerrar && (
            <BotonIcono variante="fantasma" tamano="sm" aria-label="Cerrar aviso" icono={<X />} onClick={onCerrar} />
          )}
        </div>
      )}
    </div>
  );
}
