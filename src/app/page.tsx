import { Dashboard } from "@/components/dashboard";
import { loadM3uPlaylist } from "@/lib/m3u";
import { fetchEpg, getEpgEntry } from "@/lib/epg";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { channels: m3uChannels, epgUrl } = await loadM3uPlaylist();
  // EPG_URL permite fijar una guía (ej. la de tu país en iptv-epg.org) aunque
  // el M3U no la referencie. Si no está configurada, se usa la del M3U si trae una.
  const resolvedEpgUrl = process.env.EPG_URL || epgUrl;
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
