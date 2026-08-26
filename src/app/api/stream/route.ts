import { getProviders, buildEmbedUrl } from "@/lib/catalog/providers";
import { fetchTitle } from "@/lib/catalog/tmdb";
import { fuentesDirectas, stremioActivo } from "@/lib/resolvers/stremio";
import type { MediaType } from "@/lib/catalog/types";
import type { ServidorStream } from "@/lib/resolvers/types";

/**
 * Lista de servidores para reproducir un título: **responde al instante**,
 * sin esperar ninguna búsqueda.
 *
 * 1. **Servidores embed** (Vimeus, VidSrc, VideoEasy): plantillas de iFrame
 *    que arrancan ya. Varios traen selector de idioma/servidor dentro del
 *    propio reproductor; el precio son sus anuncios, que desde aquí no se
 *    pueden bloquear (viven dentro del frame ajeno).
 * 2. **Servidores «Directo»**: si hay addons de Stremio configurados
 *    (`STREMIO_MANIFESTS`), enlaces .mp4/.m3u8 que la ficha reproduce en su
 *    propio `<video>` — la vía sin anuncios.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const tmdbId = Number(params.get("tmdbId"));
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return Response.json({ error: "Falta un tmdbId válido" }, { status: 400 });
  }

  // Lo desconocido se trata como película: es el caso sin temporada/episodio.
  const type: MediaType = params.get("type") === "tv" ? "tv" : "movie";
  const season = Number(params.get("season")) || undefined;
  const episode = Number(params.get("episode")) || undefined;

  const servidores: ServidorStream[] = [];
  for (const provider of getProviders()) {
    const url = buildEmbedUrl(provider, type, { tmdbId, season, episode });
    if (url) {
      servidores.push({
        id: provider.id,
        label: provider.label,
        url,
        puertaAntirrobot: provider.puertaAntirrobot,
      });
    }
  }

  // Numeración de corrido DESPUÉS del filtro: los proveedores que no cubren
  // este tipo (solo-películas…) no deben dejar huecos que parezcan botones
  // rotos.
  let numero = 0;
  for (const servidor of servidores) {
    if (servidor.id !== "propio") servidor.label = `Servidor ${++numero}`;
  }

  // --- Servidores «Directo»: enlaces sin anuncios vía addons Stremio -------
  if (stremioActivo()) {
    const ficha = await fetchTitle(tmdbId, type);
    const directos = await fuentesDirectas(
      tmdbId,
      type,
      ficha?.imdbId ?? null,
      season ?? 1,
      episode ?? 1
    );
    servidores.push(...directos);
  }

  return Response.json(
    { servidores },
    // Sin caché compartida: qué proveedores están activos puede cambiar.
    { headers: { "Cache-Control": "no-store" } }
  );
}
