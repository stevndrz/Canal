import type { MediaType } from "./types";
import { publicConfig } from "@/lib/config";

/**
 * Proveedores de reproducción por iFrame.
 *
 * En lugar de una plantilla única hay una lista, porque estos servicios fallan
 * a menudo y de forma desigual: el que no tiene una película tiene la
 * siguiente. Poder saltar de uno a otro es la diferencia entre "no funciona" y
 * "pruebo el de al lado".
 *
 * ⚠️ Estos dominios ROTAN sin aviso (AutoEmbed desapareció en 2026 y VideoEasy
 * migró de .net a .to). Si varios servidores fallan a la vez con error de DNS,
 * comprobar cuáles responden (`curl -I https://dominio/`) y actualizar aquí.
 * Para apuntar a uno propio sin tocar código existe «Mi servidor» por entorno.
 *
 * Límite que condiciona todo el diseño: **el iframe es de otro dominio, así que
 * desde aquí no se puede ver nada de lo que pasa dentro**. No hay forma de
 * saber si encontró la película, en qué idioma está, ni si dio error: el evento
 * `load` se dispara igual para una página de error. Por eso el cambio de
 * servidor lo hace la persona con un botón y no un detector automático que
 * mentiría. Es también lo que hacen estos mismos sitios en su propia web.
 *
 * Marcadores admitidos: {tmdbId} {season} {episode}
 */

export interface EmbedProvider {
  /** Identificador estable; es lo que se guarda como preferencia. */
  id: string;
  /**
   * Lo que se lee en el botón. Lo pone `getProviders()` numerando de corrido,
   * en vez de venir escrito aquí: si un proveedor se descarta por repetido, una
   * numeración fija dejaría huecos ("Servidor 2, 3, 4") y parecería roto.
   */
  label: string;
  /** Vacío en los proveedores que no cubren ese tipo (p.ej. solo películas). */
  movie: string;
  tv: string;
  /**
   * Si la URL admite pedir subtítulos en español.
   *
   * Solo está verificado en VidSrc (`ds_lang=es`, documentado y probado). En el
   * resto es el parámetro que publican ellos, sin poder comprobar el efecto
   * desde fuera del iframe: si alguno lo ignora, no rompe nada, simplemente
   * salen los subtítulos por defecto.
   */
  spanishSubtitles: boolean;
  /**
   * El proveedor esconde su reproductor detrás de una **comprobación
   * antirrobot** (Cloudflare Turnstile y parecidas).
   *
   * En un ordenador o un teléfono se pasa sola y no se nota. En el navegador de
   * un televisor NO se pasa nunca —Turnstile no admite esos motores—, y el
   * problema es lo que hacen esas puertas al fallar: recargarse. La de VidSrc
   * trae tres `window.location.reload()`, uno por cada camino de error, así que
   * el marco se queda dando vueltas para siempre. Es el bucle reportado en un
   * Samsung.
   *
   * Ojo: la puerta vive en un iframe ANIDADO dentro del suyo, así que desde
   * nuestra página no hay forma de contar esas recargas —el evento `load` de
   * nuestro iframe no se dispara cuando navega un marco nieto (comprobado: 14
   * navegaciones reales, 1 evento visto)—. Por eso no se detecta: se evita, y
   * en un televisor estos proveedores van los últimos.
   */
  puertaAntirrobot?: boolean;
}

/**
 * Clave pública del generador de embeds de Vimeus, tal cual la comparten los
 * sitios que lo usan. Si algún día dejan de funcionar sus enlaces, es lo
 * primero que hay que regenerar desde su web.
 */
const CLAVE_VIMEUS = "mIO3kPK2Jk3hiOdw1bzXPDYYWvf-IgblslyRhziDhw";

/**
 * El orden es el producto, y manda una sola regla: **delante lo que
 * reproduce**.
 *
 * 1. **Vimeus** encabeza porque es el que trae doblaje latino, y en películas
 *    es lo que se quiere. Solo cubre películas (su ruta de series da 404), así
 *    que en series simplemente no aparece y el primero pasa a ser el siguiente.
 * 2. **Videasy** y **Vidlink** van después: cargan limpios, en película y en
 *    serie, y sin puerta de por medio. En series son, de hecho, los primeros.
 * 3. **VidSrc** y **Multiembed** van al FINAL, aunque VidSrc sea el único con
 *    subtítulos en español verificados. Los dos esconden su reproductor detrás
 *    de una comprobación antirrobot (`puertaAntirrobot`), y en el navegador de
 *    un televisor esas comprobaciones no se pasan nunca: la de VidSrc reacciona
 *    al fallo recargándose, tres `location.reload()` en sus tres caminos de
 *    error, y deja el marco dando vueltas para siempre. Mientras VidSrc
 *    encabezó las series —Vimeus no las cubre— CUALQUIER serie abría
 *    directamente en ese bucle.
 *
 * Unos subtítulos que no se pueden ver no valen nada, así que la regla no es
 * "el que más ofrece" sino "el que arranca".
 */
const EMBED_PROVIDERS: Omit<EmbedProvider, "label">[] = [
  {
    // El «VIMEOS» de las webs latinas (vimeus.com): el que mejor funciona y
    // con doblaje latino. Solo películas: su ruta de series responde 404.
    //
    // Verificado 2026-08-24: /e/movie?tmdb=… → 200; series probadas sin
    // éxito en TODAS las variantes (/e/tv, /e/tv?tmdb&season&episode,
    // /e/series, /e/tv/{id}, /tv, /e/show) → 404. Mientras no publiquen la
    // ruta real, `tv` queda vacío y en series el primero es Videasy.
    //
    // NOTA sobre «Vimeos» (vimeos.net, el que usan sitios como lamovie.org):
    // sus embeds son `embed-{hash}.html` con un código OPACO por
    // título/episodio resuelto en su backend — no aceptan tmdb/season/
    // episode, así que es imposible construirlos por plantilla. Sin
    // integración posible como proveedor automático.
    id: "vimeus",
    movie: `https://vimeus.com/e/movie?tmdb={tmdbId}&view_key=${CLAVE_VIMEUS}&autoplay=1`,
    tv: "",
    spanishSubtitles: false,
  },
  {
    // El que sostiene las SERIES, y el segundo en películas: carga limpio,
    // con subtítulos, varios servidores dentro y sin puerta de por medio.
    id: "videasy",
    movie: "https://player.videasy.to/movie/{tmdbId}",
    tv: "https://player.videasy.to/tv/{tmdbId}/{season}/{episode}",
    spanishSubtitles: true,
  },
  {
    // El relevo de Videasy, también sin puerta (verificado 2026-08-24, HTTP
    // 200 en tv y en movie). Sin parámetro de idioma verificado: el selector
    // de audio/subtítulos vive dentro de su propio reproductor.
    //
    // ⚠️ Es el que MÁS anuncios trae de los tres primeros: su paquete carga
    // `aclib` (AdCash) y tiene `processPopunderQueue`, que abre una pestaña
    // nueva —y devuelve el foco a la de atrás— como mucho cada 30 s. Por eso
    // va detrás de Videasy, que no lleva nada de eso.
    //
    // Los parámetros salen de su propio paquete (`searchParams.get(…)`), no
    // de suponer: `autoplay=true` arranca sin que nadie toque el vídeo —clave
    // con un mando— y `poster=false` se salta la carátula, que es un clic
    // menos dentro del marco y por tanto un popunder menos.
    id: "vidlink",
    movie: "https://vidlink.pro/movie/{tmdbId}?autoplay=true&poster=false",
    tv: "https://vidlink.pro/tv/{tmdbId}/{season}/{episode}?autoplay=true&poster=false",
    spanishSubtitles: false,
  },
  {
    // Subtítulos en español verificados (`ds_lang=es`), pero AL FINAL por su
    // puerta antirrobot: ver el comentario de orden arriba.
    id: "vidsrc",
    movie: "https://vidsrc.pm/embed/movie?tmdb={tmdbId}&ds_lang=es",
    tv: "https://vidsrc.pm/embed/tv?tmdb={tmdbId}&season={season}&episode={episode}&ds_lang=es",
    spanishSubtitles: true,
    // Verificado 2026-08-26 sobre la serie tmdb=123192 que lo destapó: su
    // página anida `nextgencloudfabric.com`, y ese marco trae la puerta de
    // Turnstile con tres `location.reload()` en sus caminos de fallo.
    puertaAntirrobot: true,
  },
  {
    id: "multiembed",
    movie: "https://multiembed.mov/?video_id={tmdbId}&tmdb=1",
    tv: "https://multiembed.mov/?video_id={tmdbId}&tmdb=1&season={season}&episode={episode}",
    spanishSubtitles: false,
    // También detrás de una comprobación de Cloudflare (verificado: 403 con
    // reto en película y en serie).
    puertaAntirrobot: true,
  },
];

/**
 * Proveedor propio definido por entorno, que se antepone a la lista.
 *
 * Sirve para apuntar a un servidor propio sin recompilar, y para reaccionar
 * rápido si todos los de arriba caen a la vez.
 */
function providerFromEnv(): Omit<EmbedProvider, "label"> | null {
  const movie = publicConfig.embedPropioPelicula;
  const tv = publicConfig.embedPropioSerie;
  if (!movie && !tv) return null;
  return {
    id: "propio",
    movie: movie || tv || "",
    tv: tv || movie || "",
    spanishSubtitles: /(?:ds_lang|sub|sub_lang|lang)=es/i.test(`${movie} ${tv}`),
  };
}

/** Dominio de una plantilla, para detectar proveedores repetidos. */
function hostOf(template: string): string {
  try {
    return new URL(template).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Lista disponible, con el proveedor propio delante si lo hay.
 *
 * Se descarta el de la lista fija que apunte al mismo dominio que el propio:
 * si no, quien configure por entorno uno que ya está incluido acaba con dos
 * botones idénticos y probando dos veces lo mismo al fallar algo.
 */
export function getProviders(): EmbedProvider[] {
  const propio = providerFromEnv();
  const lista = propio
    ? [
        propio,
        // Fuera el de la lista fija que apunte al mismo sitio que el propio.
        ...EMBED_PROVIDERS.filter(
          (provider) => hostOf(provider.movie) !== (hostOf(propio.movie) || hostOf(propio.tv))
        ),
      ]
    : EMBED_PROVIDERS;

  let numero = 0;
  return lista.map((provider) => ({
    ...provider,
    label: provider.id === "propio" ? "Mi servidor" : `Servidor ${++numero}`,
  }));
}

export interface EmbedTarget {
  tmdbId: number;
  season?: number;
  episode?: number;
}

/** URL del iframe para un proveedor concreto, o null si no se puede armar. */
export function buildEmbedUrl(
  provider: EmbedProvider,
  mediaType: MediaType,
  target: EmbedTarget
): string | null {
  const pattern = (mediaType === "movie" ? provider.movie : provider.tv).trim();
  if (!pattern || !target.tmdbId) return null;

  const url = pattern
    .replaceAll("{tmdbId}", String(target.tmdbId))
    .replaceAll("{season}", String(target.season ?? 1))
    .replaceAll("{episode}", String(target.episode ?? 1));

  // Solo http(s): evita que una plantilla mal escrita acabe en javascript:
  return /^https?:\/\//i.test(url) ? url : null;
}
