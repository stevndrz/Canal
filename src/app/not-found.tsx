import { Compass, House } from "lucide-react";
import { Boton, PantallaMensaje } from "@/components/ui";

/**
 * La 404 de la aplicación.
 *
 * Sin este archivo, Next sirve la suya: **texto negro sobre fondo blanco**, en
 * una app que es oscura de arriba abajo. En un televisor, a oscuras, eso es un
 * fogonazo blanco a pantalla completa.
 *
 * Y con el mando tiene que tener salida: aquí no hay armazón ni navegación
 * espacial, así que `PantallaMensaje` pone el primer foco en «Ir al inicio»
 * (en la tele), mueve las flechas y hace que Atrás vuelva a Inicio. Antes el
 * foco se quedaba en `<body>` y ninguna tecla hacía nada.
 */
export default function NoEncontrado() {
  return (
    <PantallaMensaje
      icono={<Compass />}
      titulo="Aquí no hay nada"
      texto="La página que buscabas no existe o cambió de sitio. Pulsa Atrás o vuelve al inicio."
      acciones={
        <Boton href="/" variante="primario" tamano="lg" icono={<House />}>
          Ir al inicio
        </Boton>
      }
    />
  );
}
