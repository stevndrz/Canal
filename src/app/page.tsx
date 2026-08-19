import { Dashboard } from "@/components/dashboard";
import { loadM3uPlaylist } from "@/lib/m3u";
import { fetchEpg, getEpgEntry } from "@/lib/epg";
import type { Channel } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { channels: parsedChannels, epgUrl } = await loadM3uPlaylist();

  // La guía de programación es opcional: si la lista M3U no referencia ninguna
  // y no hay EPG_URL configurada, la app funciona igual, solo sin horarios.
  const resolvedEpgUrl = process.env.EPG_URL || epgUrl;
  const epg = resolvedEpgUrl ? await fetchEpg(resolvedEpgUrl) : null;
  // Server Component: corre una vez por request en el servidor, no en cada
  // re-render de un componente cliente, así que Date.now() es seguro aquí.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const initialChannels: Channel[] = parsedChannels.map((channel, index) => {
    const entry = epg ? getEpgEntry(epg, channel.tvgId, channel.name, now) : null;
    return {
      ...channel,
      id: index + 1,
      number: String(index + 1),
      currentProgram: entry?.current?.title ?? "",
      nextProgram: entry?.next?.title ?? "",
      isFavorite: false,
    };
  });

  return <Dashboard initialChannels={initialChannels} />;
}
