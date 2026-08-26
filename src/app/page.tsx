import { Dashboard } from "@/components/dashboard";
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
 * Se queda DINÁMICA, y conviene decir por qué para que nadie lo intente otra
 * vez pensando que es una mejora gratis.
 *
 * `revalidate` parece la respuesta obvia —nada aquí depende de quién pide la
 * página— pero choca con dos cosas del código actual:
 *
 *  1. `m3u.ts` descarga con `cache: "no-store"` a propósito: la caché de datos
 *     de Next descarta respuestas de más de 2 MB y estas listas las superan.
 *     Eso es `revalidate: 0`, y saca a la ruta del renderizado estático.
 *  2. `Dashboard` lee `useSearchParams()` para el `?vista=`, que exige una
 *     frontera de Suspense para poder prerenderizar.
 *
 * Y además cachear el HTML ahorraría trabajo al SERVIDOR, no al televisor. Lo
 * que de verdad se nota desde el sofá es cuántos bytes hay que descargar e
 * interpretar antes de ver algo, y eso es lo que ataca el recorte de abajo: la
 * parte cacheable de esta página ya no es el HTML, es `/api/canales`.
 */
export const dynamic = "force-dynamic";

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

export default async function HomePage() {
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
