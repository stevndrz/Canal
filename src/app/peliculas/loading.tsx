import { EsqueletoSuperior } from "@/components/esqueleto-superior";
import { EsqueletoCatalogo } from "@/components/esqueleto-catalogo";

/**
 * Lo que se ve al entrar en Cine y series.
 *
 * Next prefetchea este fallback, así que la respuesta al clic es inmediata:
 * cubre el hueco hasta que llega el armazón de la página. A partir de ahí toma
 * el relevo el `<Suspense>` de `page.tsx`, que pinta este mismo esqueleto
 * mientras TMDB streamea las listas — el mismo dibujo a propósito, para que la
 * pantalla no cambie dos veces.
 */
export default function CargandoCatalogo() {
  return (
    <div className="app-shell bg-black" aria-busy="true" aria-label="Cargando Cine y series">
      <EsqueletoSuperior />
      <EsqueletoCatalogo />
    </div>
  );
}
