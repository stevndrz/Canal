import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard";
import { loadM3uChannels } from "@/lib/m3u";
import { LoginScreen } from "@/components/login-screen";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return <LoginScreen />;
  if (!user.householdId) return <LoginScreen />;

  const channelRows = await db
    .select()
    .from(channels)
    .where(eq(channels.householdId, user.householdId))
    .orderBy(asc(channels.id));

  const m3uChannels = await loadM3uChannels();
  const allowedStreamUrls = new Set(m3uChannels.map((channel) => channel.streamUrl));
  const visibleRows = allowedStreamUrls.size > 0
    ? channelRows.filter((row) => row.streamUrl && allowedStreamUrls.has(row.streamUrl))
    : channelRows;

  const initialChannels = visibleRows.map((row) => ({
    ...row,
    number: row.number ?? String(row.id),
    category: row.category ?? "Nacional",
    description: row.description ?? "",
    logoText: row.logoText ?? "TV",
    logoUrl: row.logoUrl ?? "",
    streamUrl: row.streamUrl ?? "",
    color: row.color ?? "#0f766e",
    websiteUrl: row.websiteUrl ?? "",
    currentProgram: row.currentProgram ?? "",
    nextProgram: row.nextProgram ?? "",
    progress: row.progress ?? 0,
    isFavorite: row.isFavorite ?? false,
    isLive: row.isLive ?? true,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
  }));

  const fallbackChannels = m3uChannels.map((channel, index) => ({
    id: index + 1,
    ...channel,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  return <Dashboard initialChannels={initialChannels.length > 0 ? initialChannels : fallbackChannels} />;
}
