import { numerarServidores, servidoresEmbed } from "@/lib/catalog/providers";
import { esTelevisorUA } from "@/lib/dispositivo";
import { fetchTitle } from "@/lib/catalog/tmdb";
import { fuentesDirectas, stremioActivo } from "@/lib/resolvers/stremio";
import type { MediaType } from "@/lib/catalog/types";
import type { ServidorStream } from "@/lib/resolvers/types";
import { excedeLimite, identificarCliente, respuestaLimite } from "@/lib/limite-peticiones";
import { servidoresConElTitulo } from "@/lib/catalog/disponibilidad";

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
  /**
   * Esta es la ruta que más amplifica de la app: con `STREMIO_MANIFESTS`
   * configurado, UNA petición entrante dispara una llamada a TMDB más una por
   * cada manifiesto, todas en paralelo. Sin freno, es el mejor sitio para
   * hacer daño con el menor esfuerzo.
   */
  if (excedeLimite(identificarCliente(request))) return respuestaLimite();

  const params = new URL(request.url).searchParams;

  const tmdbId = Number(params.get("tmdbId"));
  if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
    return Response.json({ error: "Falta un tmdbId válido" }, { status: 400 });
  }

  // Lo desconocido se trata como película: es el caso sin temporada/episodio.
  const type: MediaType = params.get("type") === "tv" ? "tv" : "movie";
  const season = Number(params.get("season")) || undefined;
  const episode = Number(params.get("episode")) || undefined;

  /**
   * En un televisor, los de puerta antirrobot van los últimos. Ver
   * `ordenarParaTelevisor`: allí está el porqué y lo que cuesta.
   */
  const enTelevisor = esTelevisorUA(request.headers.get("user-agent") ?? "");
  const candidatos = servidoresEmbed(type, { tmdbId, season, episode }, enTelevisor);

  /**
   * Fuera los que ya han dicho que no tienen este título.
   *
   * Antes se ofrecían igual y quien estuviera delante se encontraba el «Not
   * Found» del proveedor dentro del marco. Ver `disponibilidad.ts`: solo se
   * pregunta a los que responden con un estado que ya se comprobó qué
   * significa, y si la pregunta falla el servidor se conserva.
   */
  const servidores: ServidorStream[] = numerarServidores(
    await servidoresConElTitulo(candidatos),
  );

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
