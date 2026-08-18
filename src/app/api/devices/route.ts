import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { devices } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.householdId) return Response.json({ error: "No autorizado" }, { status: 401 });
  return Response.json(await db.select().from(devices).where(eq(devices.householdId, user.householdId)).orderBy(asc(devices.id)));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.householdId) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return Response.json({ error: "Escribe un nombre para el dispositivo." }, { status: 400 });
  const code = `CC-${Math.floor(1000 + Math.random() * 9000)}`;
  const [item] = await db.insert(devices).values({ householdId: user.householdId, name, type: String(body.type || "Smart TV"), room: String(body.room || "Sala"), status: "offline", code }).returning();
  return Response.json(item, { status: 201 });
}