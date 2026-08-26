import { Compass } from "lucide-react";
import { EstadoVacio } from "@/components/catalog/estado-vacio";

/**
 * La 404 de la aplicación.
 *
 * Sin este archivo, Next sirve la suya: **texto negro sobre fondo blanco**, en
 * una app que es negra de arriba abajo. En un televisor, a oscuras, eso es un
 * fogonazo blanco a pantalla completa, y encima sin ninguna forma de volver
 * que no sea el botón Atrás del mando.
 */
export default function NoEncontrado() {
  return (
    <main className="pantalla-mensaje">
      <EstadoVacio
        Icono={Compass}
        titulo="Aquí no hay nada"
        detalle="La página que buscabas no existe o cambió de sitio."
        accion={{ href: "/", texto: "Ir al inicio" }}
      />
    </main>
  );
}
