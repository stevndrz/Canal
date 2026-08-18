export function getConfiguredM3uSource() {
  return process.env.M3U_URL || "gt.m3u";
}

export async function getM3uContent(): Promise<string | null> {
  const source = getConfiguredM3uSource();

  try {
    const res = await fetch(source, { next: { revalidate: 60 } });
    if (res.ok) return await res.text();
    console.error(`❌ No se pudo descargar M3U desde ${source}`);
  } catch (error) {
    console.error(`❌ Error descargando M3U desde ${source}:`, error);
  }

  return null;
}