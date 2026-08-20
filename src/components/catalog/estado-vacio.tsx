import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * «Aquí no hay nada», con el mismo aspecto en toda la aplicación.
 *
 * Antes cada sitio se pintaba el suyo con utilidades sueltas —`bg-white/5`,
 * `rounded-2xl`, anillos de foco morados— y ninguno se parecía al resto ni al
 * diseño de la app. Un estado vacío es lo que se ve cuando algo va mal, que es
 * justo cuando peor sienta que el producto parezca de otro.
 */
export function EstadoVacio({
  Icono,
  titulo,
  detalle,
  accion,
}: {
  Icono: LucideIcon;
  titulo: string;
  detalle?: string;
  accion?: { href: string; texto: string };
}) {
  return (
    <div className="estado-vacio">
      <Icono aria-hidden="true" />
      <p className="estado-vacio-titulo">{titulo}</p>
      {detalle && <p className="estado-vacio-detalle">{detalle}</p>}
      {accion && (
        <Link href={accion.href} className="secondary" data-nav="button">
          {accion.texto}
        </Link>
      )}
    </div>
  );
}
