import { Dashboard } from "@/components/dashboard";
import { loadM3uPlaylist } from "@/lib/m3u";
import { fetchEpg, getEpgEntry } from "@/lib/epg";

export const dynamic = "force-dynamic";

// Guía EPG de Guatemala (iptv-epg.org). El Gist M3U no referencia ninguna
// guía propia (sin url-tvg), así que esta es la que se usa por defecto;
// EPG_URL permite reemplazarla sin tocar código.
const DEFAULT_EPG_URL = "https://iptv-epg.org/files/epg-gt.xml.gz";

export default async function HomePage() {
  const { channels: m3uChannels, epgUrl } = await loadM3uPlaylist();
  const resolvedEpgUrl = process.env.EPG_URL || epgUrl || DEFAULT_EPG_URL;
  const epg = resolvedEpgUrl ? await fetchEpg(resolvedEpgUrl) : null;
  // Server Component: se ejecuta una vez por request en el servidor, no en
  // cada re-render de un componente cliente, así que Date.now() es seguro aquí.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const initialChannels = m3uChannels.map((channel, index) => {
    const entry = epg ? getEpgEntry(epg, channel.tvgId, channel.name, now) : null;
    return {
      id: index + 1,
      ...channel,
      currentProgram: entry?.current?.title ?? "",
      nextProgram: entry?.next?.title ?? "",
    };
  });

  return <Dashboard initialChannels={initialChannels} />;
}
