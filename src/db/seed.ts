import "dotenv/config";
import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import * as iptvParser from "iptv-playlist-parser";
import { db } from "@/db";
import { channels, devices, households, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

/**
 * Obtiene el contenido M3U desde una URL remota o un archivo local.
 * En Vercel usa M3U_URL (puede ser una URL pública del archivo).
 */
async function getM3uContent(): Promise<string | null> {
  // 1. URL remota (recomendado para Vercel)
  const remoteUrl = process.env.M3U_URL;
  if (remoteUrl) {
    try {
      const res = await fetch(remoteUrl);
      if (res.ok) return await res.text();
      console.error(`❌ No se pudo descargar M3U desde ${remoteUrl}`);
    } catch (error) {
      console.error("❌ Error descargando M3U:", error);
    }
  }

  // 2. Archivo local (desarrollo)
  const localPath = process.env.M3U_PATH || "/home/pc/Canal/gt.m3u";
  try {
    if (fs.existsSync(localPath)) {
      return fs.readFileSync(localPath, "utf-8");
    }
  } catch {
    // ignorar
  }

  return null;
}

export async function importM3uToDatabase(householdId: number) {
  try {
    const m3uText = await getM3uContent();
    if (!m3uText) {
      console.log("⚠️ No se encontró archivo M3U (local o remoto).");
      return;
    }

    const parseFn = iptvParser.parse || (iptvParser as any).default || iptvParser;
    const parsed = parseFn(m3uText);

    const rawChannels = (parsed as any)?.channels || parsed?.items || [];

    if (!Array.isArray(rawChannels) || rawChannels.length === 0) {
      console.log("⚠️ No se encontraron canales o la estructura del M3U no es válida.");
      return;
    }

    const channelsToInsert = rawChannels.map((item: any, index: number) => ({
      householdId,
      name: item.name || item.title || `Canal ${index + 1}`,
      number: (index + 1).toString(),
      category: item.group?.title || item.group || "Nacional",
      description: `Señal en vivo de ${item.name || item.title || "Canal"}`,
      logoText: item.name ? item.name.substring(0, 2).toUpperCase() : "TV",
      logoUrl: item.tvg?.logo || item.logo || "",
      streamUrl: item.url,
      color: "#2563eb",
      websiteUrl: "",
      currentProgram: "Transmisión en vivo",
      nextProgram: "Programación regular",
      progress: 50,
      isFavorite: false,
      isLive: true,
    }));

    await db.delete(channels).where(eq(channels.householdId, householdId));
    await db.insert(channels).values(channelsToInsert);
    console.log(`✅ ¡Éxito! Se importaron ${channelsToInsert.length} canales.`);
  } catch (error) {
    console.error("❌ Error al procesar el archivo M3U:", error);
  }
}

/**
 * Crea los datos demo SOLO si no existen.
 * No se ejecuta en cada request (solo cuando la tabla está vacía).
 */
export async function ensureDemoData() {
  const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
  if (existingUsers.length > 0) return;

  let [home] = await db
    .select()
    .from(households)
    .where(eq(households.name, "Familia Morales"))
    .limit(1);

  if (!home) {
    [home] = await db
      .insert(households)
      .values({ name: "Familia Morales" })
      .returning();
  }

  await db
    .insert(users)
    .values({
      householdId: home.id,
      name: "Ana Morales",
      email: "familia@demo.gt",
      passwordHash: hashPassword("familia123"),
      avatar: "AM",
    })
    .onConflictDoNothing({ target: users.email });

  await importM3uToDatabase(home.id);

  const existingDevices = await db.select({ id: devices.id }).from(devices).limit(1);
  if (existingDevices.length === 0) {
    await db.insert(devices).values([
      {
        householdId: home.id,
        name: "TV Sala Principal",
        type: "Smart TV",
        room: "Sala",
        status: "online",
        code: "TV-SALA-01",
      },
    ]);
  }
}

// Solo se ejecuta cuando se llama directamente: `npm run db:seed`
if (process.argv[1] && process.argv[1].endsWith("seed.ts")) {
  ensureDemoData()
    .then(() => {
      console.log("🚀 Proceso de carga M3U finalizado.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Error inesperado ejecutando el seed:", err);
      process.exit(1);
    });
}