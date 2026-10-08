import { Suspense } from "react";
import { NavegacionCatalogo } from "@/components/catalog/navegacion-catalogo";
import { SeccionCatalogo, type Filtro } from "@/components/catalog/seccion-catalogo";
import { TopNav } from "@/components/shell/top-nav";
import { EsqueletoCatalogo } from "@/components/esqueleto-catalogo";
import type { SeccionCatalogo as IdSeccion } from "@/lib/catalog/secciones";

/**
 * El armazón de Películas, Series y Anime: barra, mando y el catálogo debajo
 * del `<Suspense>`. Las tres rutas son esto con otra sección.
 */
export function PaginaCatalogo({ seccion, searchParams }: { seccion: IdSeccion; searchParams: Promise<Filtro> }) {
  // La promesa NO se espera aquí: `searchParams` es una API dinámica y
  // consumirla en la raíz convertiría TODO el armazón —la barra que da el
  // «instantáneo» al clic— en algo servible solo tras un render completo.
  // La recibe `SeccionCatalogo`, que vive debajo del `<Suspense>`.
  return (
    /* El mando: esta ruta vive fuera del shell, así que monta su propia
       navegación espacial. Ver `navegacion-catalogo.tsx`. */
    <NavegacionCatalogo>
      {/* Sin `bg-black`: el fondo es el de la app (el halo de `.app-shell`),
          y el héroe se disuelve en él. Con negro puro debajo, el velo del
          héroe —que acaba en el color de fondo de la app— dejaba una línea
          recta donde se juntaban los dos negros. */}
      <div className="app-shell">
        <TopNav />

        {/* El fallback es el MISMO esqueleto que el del segmento
            (`loading.tsx`): a quien mira no le puede cambiar la pantalla dos
            veces por un redibujado del mismo dibujo. */}
        <Suspense fallback={<EsqueletoCatalogo />}>
          <SeccionCatalogo seccion={seccion} filtro={searchParams} />
        </Suspense>
      </div>
    </NavegacionCatalogo>
  );
}
