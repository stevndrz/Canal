import { eq } from "drizzle-orm";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import { createSession, hashPassword, initials } from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const household = String(body.household ?? "Mi hogar").trim();
  if (name.length < 2 || !email.includes("@") || password.length < 8) return Response.json({ error: "Completa los datos; la contraseña debe tener 8 caracteres." }, { status: 400 });
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (exists.length) return Response.json({ error: "Este correo ya tiene una cuenta." }, { status: 409 });
  const [home] = await db.insert(households).values({ name: household || "Mi hogar" }).returning();
  const [user] = await db.insert(users).values({ householdId: home.id, name, email, passwordHash: hashPassword(password), avatar: initials(name) }).returning();
  await createSession(user.id);
  return Response.json({ ok: true }, { status: 201 });
}
