import { Dashboard } from "@/components/dashboard";
import { loadM3uPlaylist } from "@/lib/m3u";
import { fetchEpg, getEpgEntry } from "@/lib/epg";
import { getCatalogSections } from "@/lib/catalog/catalog";
import type { CatalogSection } from "@/lib/catalog/types";
import type { Channel } from "@/lib/types";
import { serverConfig } from "@/lib/config.server";

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
  const initialChannels: Channel[] = parsedChannels.map((channel, index) => {
    const entry = epg ? getEpgEntry(epg, "", channel.name, now) : null;
    const base: Channel = { ...channel, id: index + 1 };
    if (!entry) return base;

    if (entry.current?.title) base.currentProgram = entry.current.title;
    if (entry.next?.title) base.nextProgram = entry.next.title;
    if (entry.current?.start !== undefined) base.currentStart = entry.current.start;
    if (entry.current?.stop !== undefined) base.currentEnd = entry.current.stop;
    if (entry.next?.start !== undefined) base.nextStart = entry.next.start;
    return base;
  });

  return <Dashboard initialChannels={initialChannels} catalog={catalog} />;
}
