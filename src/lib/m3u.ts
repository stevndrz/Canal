import fs from "fs";
import path from "path";
import * as iptvParser from "iptv-playlist-parser";

export interface ParsedM3uChannel {
  name: string;
  number: string;
  category: string;
  description: string;
  logoText: string;
  logoUrl: string;
  streamUrl: string;
  color: string;
  websiteUrl: string;
  currentProgram: string;
  nextProgram: string;
  progress: number;
  isFavorite: boolean;
  isLive: boolean;
}

/**
 * Obtiene el contenido M3U desde una URL remota o desde el archivo incluido en el proyecto.
 * En Vercel se recomienda configurar M3U_URL para actualizar la lista sin redeploys.
 */
export async function getM3uContent(): Promise<string | null> {
  const remoteUrl = process.env.M3U_URL;
  if (remoteUrl) {
    try {
      const res = await fetch(remoteUrl, { next: { revalidate: 300 } });
      if (res.ok) return await res.text();
      console.error(`❌ No se pudo descargar M3U desde ${remoteUrl}`);
    } catch (error) {
      console.error("❌ Error descargando M3U:", error);
    }
  }

  const candidates = [
    process.env.M3U_PATH,
    path.join(process.cwd(), "gt.m3u"),
  ].filter(Boolean) as string[];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) return fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      console.error(`❌ Error leyendo M3U local en ${filePath}:`, error);
    }
  }

  return null;
}

function getParser() {
  return iptvParser.parse || (iptvParser as unknown as { default?: typeof iptvParser.parse }).default || iptvParser;
}

export function parseM3uChannels(m3uText: string): ParsedM3uChannel[] {
  const parsed = getParser()(m3uText);
  const rawChannels = (parsed as any)?.channels || (parsed as any)?.items || [];

  if (!Array.isArray(rawChannels)) return [];

  return rawChannels
    .filter((item: any) => Boolean(item?.url))
    .map((item: any, index: number) => {
      const name = item.name || item.title || `Canal ${index + 1}`;
      const logoUrl = item.tvg?.logo || item.logo || "";

      return {
        name,
        number: String(index + 1),
        category: item.group?.title || item.group || "General",
        description: `Señal en vivo de ${name}`,
        logoText: name.substring(0, 2).toUpperCase(),
        logoUrl,
        streamUrl: item.url,
        color: "#2dd4bf",
        websiteUrl: "",
        currentProgram: "Transmisión en vivo",
        nextProgram: "Programación regular",
        progress: 50,
        isFavorite: false,
        isLive: true,
      };
    });
}

export async function loadM3uChannels(): Promise<ParsedM3uChannel[]> {
  const m3uText = await getM3uContent();
  return m3uText ? parseM3uChannels(m3uText) : [];
}
