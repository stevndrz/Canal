import type { MediaType } from "./types";

/**
 * Proveedores de reproducción por iframe.
 *
 * En lugar de una plantilla única hay una lista, porque estos servicios fallan
 * a menudo y de forma desigual: el que no tiene una película tiene la
 * siguiente. Poder saltar de uno a otro es la diferencia entre "no funciona" y
 * "pruebo el de al lado".
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
}

/**
 * Orden por defecto: delante los que aceptan pedir subtítulos en español.
 *
 * Es la única preferencia de idioma que se puede aplicar de verdad. Qué pista
 * de AUDIO tiene cada servidor no lo publica ninguno, así que ordenar por
 * "tiene español latino" sería inventado; lo que sí se sabe con certeza es el
 * idioma original de la película, y eso viene de TMDB.
 */
const EMBED_PROVIDERS: Omit<EmbedProvider, "label">[] = [
  {
    id: "vidsrc",
    movie: "https://vidsrc.pm/embed/movie?tmdb={tmdbId}&ds_lang=es",
    tv: "https://vidsrc.pm/embed/tv?tmdb={tmdbId}&season={season}&episode={episode}&ds_lang=es",
    spanishSubtitles: true,
  },
  {
    id: "vidlink",
    movie: "https://vidlink.pro/movie/{tmdbId}?player=default&sub_lang=es",
    tv: "https://vidlink.pro/tv/{tmdbId}/{season}/{episode}?player=default&sub_lang=es",
    spanishSubtitles: true,
  },
  {
    id: "vidfast",
    movie: "https://vidfast.pro/movie/{tmdbId}?sub=es",
    tv: "https://vidfast.pro/tv/{tmdbId}/{season}/{episode}?sub=es",
    spanishSubtitles: true,
  },
  {
    id: "2embed",
    movie: "https://www.2embed.cc/embed/{tmdbId}",
    tv: "https://www.2embed.cc/embedtv/{tmdbId}&s={season}&e={episode}",
    spanishSubtitles: false,
  },
];

/**
 * Proveedor propio definido por entorno, que se antepone a la lista.
 *
 * Sirve para apuntar a un servidor propio sin recompilar, y para reaccionar
 * rápido si todos los de arriba caen a la vez.
 */
function providerFromEnv(): Omit<EmbedProvider, "label"> | null {
  const movie = process.env.NEXT_PUBLIC_EMBED_PROVIDER_MOVIE?.trim();
  const tv = process.env.NEXT_PUBLIC_EMBED_PROVIDER_TV?.trim();
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

export function findProvider(id: string | null | undefined): EmbedProvider | null {
  if (!id) return null;
  return getProviders().find((provider) => provider.id === id) ?? null;
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
