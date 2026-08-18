import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, devices } from "@/db/schema";
import { ensureDemoData } from "@/db/seed";
import { getCurrentUser } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard";
import { LoginScreen } from "@/components/login-screen";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureDemoData();
  const user = await getCurrentUser();
  if (!user) return <LoginScreen />;
  const [channelRows, deviceRows] = await Promise.all([
    db.select().from(channels).where(eq(channels.householdId, user.householdId)).orderBy(asc(channels.id)),
    db.select().from(devices).where(eq(devices.householdId, user.householdId)).orderBy(asc(devices.id)),
  ]);
  return <Dashboard user={user} initialChannels={channelRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }))} initialDevices={deviceRows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), lastSeen: row.lastSeen.toISOString() }))} />;
}
