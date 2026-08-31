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
 *
 * Sin `dynamic = "force-dynamic"`: bajo `cacheComponents` las exportaciones de
 * configuración de segmento ya no existen en rutas. Sigue respondiendo en
 * vivo —lee la petición y consulta disponibilidad por request— porque no hay
 * nada que cachear aquí, igual que antes.
 */
/**
 * Techos de lo que se acepta en la consulta.
 *
 * No son validación de formato —eso ya estaba— sino de **tamaño del espacio de
 * claves**. Estos tres valores viajan dentro de la URL que se le pregunta a
 * cada proveedor, y esa URL es la clave de la caché de `disponibilidad.ts`.
 * Aceptando cualquier entero hasta 2^53, quien llama dispone de un espacio de
 * claves infinito: cada petición es un fallo de caché garantizado y, con él,
 * peticiones salientes de verdad hacia los proveedores.
 *
 * Los topes van holgados sobre lo que existe —TMDB anda por el millón largo de
 * ids, y ninguna serie tiene mil temporadas— así que no rechazan nada real; lo
 * que hacen es dejar el espacio de claves en algo finito y del tamaño del
 * catálogo, no del tamaño de un entero.
 */
const MAX_TMDB_ID = 100_000_000;
const MAX_TEMPORADA = 1_000;
const MAX_EPISODIO = 10_000;

/** El número si está dentro de lo razonable; si no, nada. */
function enRango(valor: string | null, tope: number): number | undefined {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0 || numero > tope) return undefined;
  return numero;
}

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
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || tmdbId > MAX_TMDB_ID) {
    return Response.json({ error: "Falta un tmdbId válido" }, { status: 400 });
  }

  // Lo desconocido se trata como película: es el caso sin temporada/episodio.
  const type: MediaType = params.get("type") === "tv" ? "tv" : "movie";
  const season = enRango(params.get("season"), MAX_TEMPORADA);
  const episode = enRango(params.get("episode"), MAX_EPISODIO);

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
