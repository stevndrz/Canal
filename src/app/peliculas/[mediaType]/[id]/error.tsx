"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

/**
 * Cuando la ficha revienta de verdad.
 *
 * Hasta ahora esta ruta solo tenía `<Suspense>`: si `fetchTitle` o
 * `fetchSeason` alguna vez lanzaran en vez de devolver `null` —la regla que
 * siguen hoy, ver `tmdb.ts`—, la ruta entera caía al `error.tsx` de la raíz,
 * que no sabe nada de catálogo y no ofrece volver a él. Este es el mismo
 * patrón que `estado-vacio.tsx` para que la caída se vea como el resto de la
 * app y no como un cristal roto.
 *
 * `reset()` reintenta sin recargar toda la página; «Volver al catálogo» es la
 * salida para cuando el problema es el título, no la red.
 */
export default function ErrorDeFicha({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // El `digest` es lo único que ata esta pantalla con la traza del
    // servidor: sin registrarlo, un fallo en producción es irrastreable.
    console.error("La ficha no cargó:", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="pantalla-mensaje">
      <div className="estado-vacio">
        <TriangleAlert aria-hidden="true" />
        <p className="estado-vacio-titulo">No se pudo abrir esta ficha</p>
        <p className="estado-vacio-detalle">
          TMDB no respondió, o el título dejó de existir. Reintentar suele bastar.
        </p>
        <button type="button" data-nav="button" className="secondary" autoFocus onClick={reset}>
          Reintentar
        </button>
        <Link href="/peliculas" data-nav="button" className="secondary">
          Volver al catálogo
        </Link>
      </div>
    </main>
  );
}
