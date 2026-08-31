import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { EsqueletoSuperior } from "@/components/esqueleto-superior";
import { EsqueletoPortada } from "@/components/esqueleto-portada";
import { getCatalogSections } from "@/lib/catalog/catalog";
import type { CatalogSection } from "@/lib/catalog/types";
import type { FilaDeTarjetas } from "@/components/catalog/catalog-row";
import { catalogToCard } from "@/lib/media-item";
import {
  QUE_SE_PINTA,
  posicionesIniciales,
  recortarPaquete,
  type PaqueteCanales,
} from "@/lib/canales-empaquetados";
import { paqueteDeCanales } from "@/lib/lista-canales";
import { serverConfig } from "@/lib/config.server";
import { publicConfig } from "@/lib/config";
import { normalizeChannelName } from "@/lib/text";

/**
 * Sin `dynamic = "force-dynamic"`: bajo `cacheComponents` sobra, y el armazón
 * se prerenderiza igual. La portada sigue esperando la M3U en cada render
 * porque `m3u.ts` descarga con `cache: "no-store"` —la caché de Next descarta
 * respuestas de más de 2 MB y estas listas las superan—.
 *
 * Cachear el HTML ahorraría trabajo al SERVIDOR, no al televisor. Lo que se
 * nota desde el sofá son los bytes que hay que bajar antes de ver algo, y de
 * eso se ocupa el recorte de abajo: lo cacheable es `/api/canales`.
 */

/**
 * Mandarlo todo en el HTML, como antes.
 *
 * Es la marcha atrás sin revertir commits: `CANALES_EN_HTML=todos` y la página
 * vuelve a serializar los 7.822 canales. Está aquí porque el recorte cambia
 * cómo llegan los datos a las dos pantallas principales, y en un despliegue en
 * producción conviene poder deshacerlo en un minuto, no en un redespliegue.
 */
function mandarlosTodos(): boolean {
  return serverConfig().canalesEnHtml;
}

/**
 * Solo los canales que la primera pantalla pinta. Medido: el HTML llevaba
 * 7.822 —1,88 MB— para pintar unos 200; el resto llega por `/api/canales`,
 * cacheable en el borde. Ver `canales-empaquetados.ts` para qué se conserva y
 * por qué los `id` no se mueven (los favoritos son ids).
 */
function loJusto(paquete: PaqueteCanales): PaqueteCanales {
  if (mandarlosTodos()) return paquete;

  // El canal preferido viaja aunque esté en el puesto 5.000: si no, la app
  // abriría con otro y ya no se corregiría, porque cuando llega la lista
  // completa hay uno sintonizado desde hace rato.
  const buscado = normalizeChannelName(publicConfig.canalInicial);
  const preferido = paquete.canales.findIndex(
    ([nombre]) => normalizeChannelName(nombre) === buscado,
  );

  return recortarPaquete(
    paquete,
    posicionesIniciales(paquete, { ...QUE_SE_PINTA, ademas: preferido >= 0 ? [preferido] : [] }),
  );
}

/**
 * Todo lo que depende de datos en vivo: la M3U del día y el catálogo de TMDB.
 * Vive dentro de un `<Suspense>` para que el armazón —barra incluida— se
 * prerenderice en build y se vea al instante; antes TODO esperaba a la M3U.
 */
async function Portada() {
  const { paquete } = await paqueteDeCanales();

  // El catálogo alimenta la cabecera y los rieles de películas de Inicio. Va
  // envuelto porque son peticiones a TMDB: si la clave falta o la API se cae,
  // Inicio se queda con los canales —que es lo que de verdad importa en esta
  // app— en lugar de devolver un 500 por una sección secundaria.
  let catalog: CatalogSection[] = [];
  try {
    catalog = await getCatalogSections();
  } catch {
    catalog = [];
  }

  /**
   * A tarjetas AQUÍ, en el servidor. `Dashboard` es de cliente, así que todo lo
   * que se le pase cruza la red dentro del HTML: con `CatalogSection[]`
   * viajaban las fichas enteras de TMDB —sinopsis, reparto, temporadas— de los
   * diez carruseles para pintar título, póster, año y nota. Si no se pinta, no
   * se manda.
   */
  const filas: FilaDeTarjetas[] = catalog.map((seccion) => ({
    title: seccion.title,
    href: seccion.href,
    tarjetas: seccion.items.map(catalogToCard),
  }));

  return <Dashboard paquete={loJusto(paquete)} catalog={filas} />;
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="app-shell">
          <EsqueletoSuperior />
          <EsqueletoPortada />
        </div>
      }
    >
      <Portada />
    </Suspense>
  );
}
