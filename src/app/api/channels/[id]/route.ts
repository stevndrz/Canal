import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.householdId) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = Number((await params).id);
  const body = await request.json().catch(() => ({}));
  const allowed = ["name", "number", "category", "description", "logoText", "color", "streamUrl", "websiteUrl", "currentProgram", "nextProgram", "isFavorite", "isLive"] as const;
  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const key of allowed) if (key in body) update[key] = body[key];
  const [item] = await db.update(channels).set(update).where(and(eq(channels.id, id), eq(channels.householdId, user.householdId))).returning();
  if (!item) return Response.json({ error: "Canal no encontrado" }, { status: 404 });
  return Response.json(item);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.householdId) return Response.json({ error: "No autorizado" }, { status: 401 });
  const id = Number((await params).id);
  const [item] = await db.delete(channels).where(and(eq(channels.id, id), eq(channels.householdId, user.householdId))).returning();
  if (!item) return Response.json({ error: "Canal no encontrado" }, { status: 404 });
  return Response.json({ ok: true });
}