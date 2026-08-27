import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";
import { EsqueletoSuperior } from "@/components/esqueleto-superior";
import { EsqueletoPortada } from "@/components/esqueleto-portada";
import { getCatalogSections } from "@/lib/catalog/catalog";
import type { CatalogSection } from "@/lib/catalog/types";
import {
  QUE_SE_PINTA,
  posicionesIniciales,
  recortarPaquete,
  type PaqueteCanales,
} from "@/lib/canales-empaquetados";
import { paqueteDeCanales } from "@/lib/lista-canales";
import { publicConfig } from "@/lib/config";
import { normalizeChannelName } from "@/lib/text";

/**
 * Ya no hace falta `dynamic = "force-dynamic"`: bajo `cacheComponents` todas
 * las páginas lo son por defecto —lo que cambia es que el armazón se
 * prerenderiza igual—. Esta portada sigue esperando la lista M3U en cada
 * render a propósito:
 *
 *  1. `m3u.ts` descarga con `cache: "no-store"`: la caché de Next descarta
 *     respuestas de más de 2 MB y estas listas las superan.
 *
 * Y además cachear el HTML ahorraría trabajo al SERVIDOR, no al televisor.
 * Lo que de verdad se nota desde el sofá es cuántos bytes hay que descargar
 * e interpretar antes de ver algo, y eso lo ataca el recorte de abajo: la
 * parte cacheable ya no es el HTML, es `/api/canales`.
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
  return process.env.CANALES_EN_HTML === "todos";
}

/**
 * Solo los canales que la primera pantalla pinta de verdad.
 *
 * Medido: el HTML llevaba 7.822 canales —1,88 MB de payload— para pintar unos
 * 200. El resto llega por `/api/canales`, que sí se puede cachear en el borde.
 * Ver `canales-empaquetados.ts` para qué se conserva del paquete completo (las
 * categorías y sus recuentos, para que los contadores no mientan mientras
 * tanto) y por qué los `id` no se mueven (los favoritos son ids).
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
 * Todo lo que depende de datos en vivo: la lista M3U del día y el catálogo de
 * TMDB.
 *
 * Vive detro de un `<Suspense>` para que el armazón de la página —barra de
 * navegación incluida— pueda prerenderizarse en build: quien abre la app ve
 * la barra al instante y este bloque rellena su sitio cuando la red contesta.
 * Antes TODO esperaba a la M3U, hasta pintar nada.
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

  return <Dashboard paquete={loJusto(paquete)} catalog={catalog} />;
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
