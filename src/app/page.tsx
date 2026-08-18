import { Dashboard } from "@/components/dashboard";
import { loadM3uChannels } from "@/lib/m3u";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const m3uChannels = await loadM3uChannels();

  const initialChannels = m3uChannels.map((channel, index) => ({
    id: index + 1,
    ...channel,
  }));

  return <Dashboard initialChannels={initialChannels} />;
}