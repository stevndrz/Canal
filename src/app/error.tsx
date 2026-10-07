"use client";

import { useEffect } from "react";
import { House, RotateCw, TriangleAlert } from "lucide-react";
import { Boton, PantallaMensaje } from "@/components/ui";

/**
 * Cuando algo revienta de verdad.
 *
 * Tiene que ser un componente de cliente y llevar su propio botón: es la
 * frontera de error de React. Sin este archivo, un fallo del servidor deja la
 * pantalla en blanco sin decir nada.
 *
 * `retry()` vuelve a pedir y pintar el segmento sin recargar la página, que
 * en un televisor lento es la diferencia entre un parpadeo y quince segundos
 * de arranque en frío. Si eso no basta, «Ir al inicio» (y Atrás) recargan
 * de verdad: el fallo puede estar en la propia portada, y un `router.push`
 * a la misma ruta no arreglaría nada.
 */
export default function ErrorDeAplicacion({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // El `digest` es lo único que permite atar esta pantalla con la traza del
    // servidor: sin registrarlo, un fallo en producción es irrastreable.
    console.error("CanalCasa se cayó:", error.digest ?? error.message);
  }, [error]);

  // Recarga de verdad, a propósito (ver arriba): si la portada es lo que
  // falla, una navegación del enrutador se quedaría en este mismo error.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  const irAlInicio = () => window.location.assign("/");

  return (
    <PantallaMensaje
      icono={<TriangleAlert />}
      titulo="Algo se rompió"
      texto="No pudimos cargar esta pantalla. Suele ser un corte momentáneo: volver a intentarlo casi siempre basta."
      alAtras={irAlInicio}
      acciones={
        <>
          <Boton variante="primario" tamano="lg" icono={<RotateCw />} onClick={() => retry()}>
            Reintentar
          </Boton>
          <Boton variante="secundario" tamano="lg" icono={<House />} onClick={irAlInicio}>
            Ir al inicio
          </Boton>
        </>
      }
    />
  );
}
