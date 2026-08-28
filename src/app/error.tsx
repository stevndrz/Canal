"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

/**
 * Cuando algo revienta de verdad.
 *
 * Tiene que ser un componente de cliente y llevar su propio botón: es la
 * frontera de error de React, y aquí ya no hay enrutador que valga. Sin este
 * archivo, un fallo del servidor deja la pantalla en blanco sin decir nada.
 *
 * `reset()` vuelve a montar el árbol sin recargar la página, que en un
 * televisor lento es la diferencia entre un parpadeo y quince segundos de
 * arranque en frío.
 */
export default function ErrorDeAplicacion({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El `digest` es lo único que permite atar esta pantalla con la traza del
    // servidor: sin registrarlo, un fallo en producción es irrastreable.
    console.error("CanalCasa se cayó:", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="pantalla-mensaje">
      <div className="estado-vacio">
        <TriangleAlert aria-hidden="true" />
        <p className="estado-vacio-titulo">Algo se rompió</p>
        <p className="estado-vacio-detalle">
          No pudimos cargar esta pantalla. Suele ser un corte momentáneo; volver a intentarlo
          casi siempre basta.
        </p>
        <button type="button" data-nav="button" className="secondary" autoFocus onClick={reset}>
          Reintentar
        </button>
      </div>
    </main>
  );
}
