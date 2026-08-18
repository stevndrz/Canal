import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { devices } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.householdId) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = Number((await params).id);
  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { lastSeen: new Date() };
  for (const key of ["name", "type", "room", "status"] as const) if (key in body) update[key] = body[key];
  const [item] = await db.update(devices).set(update).where(and(eq(devices.id, id), eq(devices.householdId, user.householdId))).returning();
  if (!item) return Response.json({ error: "Dispositivo no encontrado" }, { status: 404 });
  return Response.json(item);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.householdId) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = Number((await params).id);
  const [item] = await db.delete(devices).where(and(eq(devices.id, id), eq(devices.householdId, user.householdId))).returning();
  if (!item) return Response.json({ error: "Dispositivo no encontrado" }, { status: 404 });
  return Response.json({ ok: true });
}