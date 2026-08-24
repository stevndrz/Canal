import { getProviders, buildEmbedUrl } from "@/lib/catalog/providers";
import type { MediaType } from "@/lib/catalog/types";
import type { ServidorStream } from "@/lib/resolvers/types";

/**
 * Lista de servidores embed para reproducir un título: **responde al
 * instante**, sin esperar ninguna búsqueda.
 *
 * Son plantillas de iFrame (Vimeus, VidSrc, VideoEasy): arrancan ya, y varios
 * traen selector de idioma/servidor dentro del propio reproductor, donde suele
 * estar el doblaje latino. Su cobertura no es perfecta —estrenos muy frescos
 * pueden faltar—, y por eso hay varios: si uno no tiene el título, el
 * siguiente suele tenerlo.
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
      servidores.push({ id: provider.id, label: provider.label, url });
    }
  }

  // Numeración de corrido DESPUÉS del filtro: los proveedores que no cubren
  // este tipo (solo-películas, solo-IMDB…) no deben dejar huecos que parezcan
  // botones rotos.
  let numero = 0;
  for (const servidor of servidores) {
    if (servidor.id !== "propio") servidor.label = `Servidor ${++numero}`;
  }

  return Response.json(
    { servidores },
    // Sin caché compartida: qué proveedores están activos puede cambiar.
    { headers: { "Cache-Control": "no-store" } }
  );
}
