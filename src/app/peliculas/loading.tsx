import { EsqueletoSuperior } from "@/components/esqueleto-superior";
import { EsqueletoCatalogo } from "@/components/esqueleto-catalogo";

/**
 * Lo que se ve al entrar en Películas, Series o Anime.
 *
 * Next prefetchea este fallback, así que la respuesta al clic es inmediata:
 * cubre el hueco hasta que llega el armazón de la página. A partir de ahí toma
 * el relevo el `<Suspense>` de `page.tsx`, que pinta este mismo esqueleto
 * mientras TMDB streamea las listas — el mismo dibujo a propósito, para que la
 * pantalla no cambie dos veces.
 */
export default function CargandoCatalogo() {
  return (
    // Sin `bg-black`, igual que `pagina-catalogo.tsx`: con negro puro aquí y el
    // fondo de la app allí, el fondo cambiaba al terminar de cargar.
    <div className="app-shell" aria-busy="true" aria-label="Cargando el catálogo">
      <EsqueletoSuperior />
      <EsqueletoCatalogo />
    </div>
  );
}
