import { Dashboard } from "@/components/dashboard";
import { loadM3uPlaylist } from "@/lib/m3u";
import { fetchEpg, getEpgEntry } from "@/lib/epg";
import { getCatalogSections } from "@/lib/catalog/catalog";
import type { CatalogSection } from "@/lib/catalog/types";
import { empaquetarCanales } from "@/lib/canales-empaquetados";
import { serverConfig } from "@/lib/config.server";

/**
 * Se queda DINÁMICA, y conviene decir por qué para que nadie lo intente otra
 * vez pensando que es una mejora gratis.
 *
 * `revalidate` parece la respuesta obvia —nada aquí depende de quién pide la
 * página— y ahorraría volver a serializar los canales en cada visita. Pero
 * choca con dos cosas del código actual:
 *
 *  1. `m3u.ts` descarga con `cache: "no-store"` a propósito: la caché de datos
 *     de Next descarta respuestas de más de 2 MB y estas listas las superan.
 *     Eso es `revalidate: 0`, y saca a la ruta del renderizado estático.
 *  2. `Dashboard` lee `useSearchParams()` para el `?vista=`, que exige una
 *     frontera de Suspense para poder prerenderizar.
 *
 *  Y sobre todo: cachear el HTML ahorra trabajo al SERVIDOR, no al televisor.
 *  Los 2,27 MB se seguirían descargando e interpretando igual, que es lo que
 *  de verdad se nota desde el sofá. Primero se recorta lo que se manda; volver
 *  aquí después, cuando el HTML pese poco, sí tendrá sentido.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { channels: parsedChannels, epgUrl } = await loadM3uPlaylist();

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

  // La guía de programación es opcional: si la lista M3U no referencia
  // ninguna y no hay EPG_URL configurada, la app funciona igual, solo sin
  // horarios.
  const resolvedEpgUrl = serverConfig().epgUrl || epgUrl;
  const epg = resolvedEpgUrl ? await fetchEpg(resolvedEpgUrl) : null;
  // Server Component: corre una vez por request en el servidor, no en cada
  // re-render de un componente cliente, así que Date.now() es seguro aquí.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  /**
   * Los campos de guía se **añaden solo si existen**, en lugar de asignarse
   * siempre con `?? ""` o dejarlos en `undefined`.
   *
   * No es cosmético. Esta lista se serializa entera dentro del HTML, y React
   * codifica una propiedad presente con valor `undefined` como el texto
   * literal `"$undefined"`. Con tres campos de guía por canal eso eran unos
   * 90 bytes × 7.822 = **700 KB de decir "aquí no hay nada"**. Sin guía
   * configurada, que es el caso por defecto, las cinco claves desaparecen.
   */
  const conGuia = parsedChannels.map((channel) => {
    const entry = epg ? getEpgEntry(epg, "", channel.name, now) : null;
    if (!entry) return channel;

    const base = { ...channel };
    if (entry.current?.title) base.currentProgram = entry.current.title;
    if (entry.next?.title) base.nextProgram = entry.next.title;
    if (entry.current?.start !== undefined) base.currentStart = entry.current.start;
    if (entry.current?.stop !== undefined) base.currentEnd = entry.current.stop;
    if (entry.next?.start !== undefined) base.nextStart = entry.next.start;
    return base;
  });

  /**
   * Empaquetado antes de cruzar al navegador.
   *
   * Ni `id` ni `number` viajan: el primero es la posición y el segundo lo
   * recalculaba el cliente de todas formas nada más recibirlo. La categoría va
   * como índice a una tabla de doce entradas en vez de repetir la cadena 7.822
   * veces, y cada canal es una tupla en lugar de un objeto — porque casi la
   * mitad del payload eran los nombres de las claves. Ver
   * `canales-empaquetados.ts` para el desglose medido.
   */
  return <Dashboard paquete={empaquetarCanales(conGuia)} catalog={catalog} />;
}
