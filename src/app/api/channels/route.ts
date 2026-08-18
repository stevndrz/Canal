import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !user.householdId) return Response.json({ error: "No autorizado" }, { status: 401 });
  return Response.json(await db.select().from(channels).where(eq(channels.householdId, user.householdId)).orderBy(asc(channels.id)));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !user.householdId) return Response.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const number = String(body.number ?? "").trim();
  if (!name || !number) return Response.json({ error: "Nombre y canal son obligatorios." }, { status: 400 });
  const [item] = await db.insert(channels).values({ householdId: user.householdId, name, number, category: String(body.category || "Nacional"), description: String(body.description || ""), logoText: String(body.logoText || number).slice(0, 3), color: String(body.color || "#0f766e"), streamUrl: String(body.streamUrl || ""), websiteUrl: String(body.websiteUrl || ""), currentProgram: String(body.currentProgram || "Señal en vivo"), nextProgram: String(body.nextProgram || "Próximamente"), progress: 20, isFavorite: Boolean(body.isFavorite ?? false), isLive: Boolean(body.isLive ?? true) }).returning();
  return Response.json(item, { status: 201 });
}