import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, devices, households, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

export async function ensureDemoData() {
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, "familia@demo.gt")).limit(1);
  if (existing.length) return;

  const [home] = await db.insert(households).values({ name: "Familia Morales" }).returning();
  await db.insert(users).values({
    householdId: home.id,
    name: "Ana Morales",
    email: "familia@demo.gt",
    passwordHash: hashPassword("familia123"),
    avatar: "AM",
  });
  await db.insert(channels).values([
    { householdId: home.id, name: "Canal 3", number: "3", category: "Nacional", description: "Televisión abierta guatemalteca con noticias, entretenimiento y programación familiar.", logoText: "3", color: "#e53d32", websiteUrl: "https://www.chapintv.com/", currentProgram: "Telediario", nextProgram: "Programación familiar", progress: 64, isFavorite: true },
    { householdId: home.id, name: "Televisiete", number: "7", category: "Nacional", description: "Canal nacional con deportes, noticias y entretenimiento para toda la familia.", logoText: "7", color: "#2357c6", websiteUrl: "https://www.chapintv.com/", currentProgram: "Noti 7", nextProgram: "La hora de ganar", progress: 38, isFavorite: true },
    { householdId: home.id, name: "Guatevisión", number: "25", category: "Noticias", description: "Noticias, análisis y contenido producido en Guatemala.", logoText: "G", color: "#d52b31", websiteUrl: "https://www.guatevision.com/", currentProgram: "Guatevisión Noticias", nextProgram: "Viva la mañana", progress: 76 },
    { householdId: home.id, name: "TV Azteca Guate", number: "31", category: "Entretenimiento", description: "Entretenimiento, deportes y noticias nacionales.", logoText: "A", color: "#6941c6", websiteUrl: "https://www.tvaztecaguate.com/", currentProgram: "Hechos Guatemala", nextProgram: "Al extremo", progress: 22 },
    { householdId: home.id, name: "Canal Antigua", number: "9", category: "Noticias", description: "Actualidad, opinión y periodismo guatemalteco.", logoText: "A", color: "#ed7902", websiteUrl: "https://canalantigua.tv/", currentProgram: "A las 8:45", nextProgram: "Antigua al día", progress: 48 },
    { householdId: home.id, name: "TN23", number: "23", category: "Noticias", description: "Noticias nacionales durante todo el día.", logoText: "23", color: "#087ea4", websiteUrl: "https://www.chapintv.com/", currentProgram: "Noticias TN23", nextProgram: "Reporte del clima", progress: 81 },
  ]);
  await db.insert(devices).values([
    { householdId: home.id, name: "TV Samsung", type: "Smart TV", room: "Sala", status: "online", code: "CC-4821" },
    { householdId: home.id, name: "Chromecast", type: "Google Cast", room: "Dormitorio", status: "online", code: "CC-7390" },
    { householdId: home.id, name: "Roku Express", type: "Roku", room: "Estudio", status: "offline", code: "CC-1954", lastSeen: new Date(Date.now() - 86400000) },
  ]);
}
