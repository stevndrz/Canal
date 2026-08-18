import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { households, sessions, users } from "@/db/schema";

const COOKIE_NAME = "canal-casa-session";
const SESSION_DAYS = 30;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const candidate = scryptSync(password, salt, 64);
  const original = Buffer.from(key, "hex");
  return candidate.length === original.length && timingSafeEqual(candidate, original);
}

export async function createSession(userId: number) {
  const id = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(sessions).values({ id: createHash("sha256").update(id).digest("hex"), userId, expiresAt });
  const store = await cookies();
  store.set(COOKIE_NAME, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, createHash("sha256").update(token).digest("hex")));
  store.delete(COOKIE_NAME);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, avatar: users.avatar, householdId: users.householdId, householdName: households.name })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(households, eq(users.householdId, households.id))
    .where(and(eq(sessions.id, createHash("sha256").update(token).digest("hex")), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TV";
}
