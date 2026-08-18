import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ensureDemoData } from "@/db/seed";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: Request) {
  await ensureDemoData();
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !verifyPassword(password, user.passwordHash)) return Response.json({ error: "Correo o contraseña incorrectos." }, { status: 401 });
  await createSession(user.id);
  return Response.json({ ok: true });
}
