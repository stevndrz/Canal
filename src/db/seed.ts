import "dotenv/config";
import { eq } from "drizzle-orm";
import { loadM3uChannels } from "@/lib/m3u";
import { db } from "@/db";
import { channels, devices, households, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

export async function importM3uToDatabase(householdId: number) {
  try {
    const channelsToInsert = await loadM3uChannels();
    if (channelsToInsert.length === 0) {
      console.log("⚠️ No se encontraron canales o la estructura del M3U no es válida.");
      return;
    }

    const channelsToInsertWithHousehold = channelsToInsert.map((channel) => ({
      ...channel,
      householdId,
    }));

    await db.delete(channels).where(eq(channels.householdId, householdId));
    await db.insert(channels).values(channelsToInsertWithHousehold);
    console.log(`✅ ¡Éxito! Se importaron ${channelsToInsertWithHousehold.length} canales.`);
  } catch (error) {
    console.error("❌ Error al procesar el archivo M3U:", error);
  }
}

/**
 * Crea la cuenta demo si no existe y sincroniza los canales con la lista M3U.
 * Ejecuta este script después de actualizar M3U_URL en Vercel.
 */
export async function ensureDemoData() {
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