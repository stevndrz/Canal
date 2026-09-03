import type { MediaType } from "./types";
import { publicConfig } from "@/lib/config";

/**
 * Proveedores de reproducción por iFrame.
 *
 * Una lista y no una plantilla única porque fallan a menudo y de forma
 * desigual: el que no tiene una película tiene la siguiente. Desde fuera del
 * iframe no se ve nada de lo que pasa dentro, así que el cambio de servidor lo
 * hace la persona con un botón; ver `disponibilidad.ts` para lo único que sí
 * se puede preguntar.
 *
 * ⚠️ Estos dominios ROTAN sin aviso (AutoEmbed desapareció en 2026, VideoEasy
 * migró de .net a .to). Si varios fallan a la vez con error de DNS, comprobar
 * con `curl -I https://dominio/` y actualizar aquí.
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
   * Si entrega subtítulos en español DE VERDAD. Se enseña en el botón, así que
   * no es una nota interna sino una promesa: solo va a `true` lo comprobado.
   *
   * Solo VidSrc (`ds_lang=es`, probado). Videasy estuvo en `true` por el
   * parámetro que publican, sin comprobar: no los trae —su paquete menciona
   * subtítulos 4 veces en 722 KB—. Vidlink acepta `sub_file`, pero es para
   * pasarle tú un `.vtt`, y aquí no hay ninguno.
   */
  spanishSubtitles: boolean;
  /**
   * Esconde el reproductor tras una **comprobación antirrobot** (Turnstile y
   * parecidas). En PC y teléfono se pasa sola; en un televisor NO se pasa
   * nunca, y al fallar esas puertas se recargan —la de VidSrc trae tres
   * `location.reload()`, uno por camino de error—, así que el marco se queda
   * dando vueltas. Es el bucle reportado en un Samsung.
   *
   * No se puede detectar: la puerta vive en un iframe ANIDADO, y el `load` del
   * nuestro no se dispara cuando navega un marco nieto (medido: 14
   * navegaciones reales, 1 evento visto). Se evita — en televisor van últimos.
   */
  puertaAntirrobot?: boolean;
  /**
   * El proveedor **dice** con un estado HTTP cuándo no tiene un título — la
   * única pregunta honesta que admite un embed desde fuera.
   *
   * Comprobado con curl contra catorce ids reales: Vimeus da 404 y Vidlink
   * 500 cuando no lo tienen, 200 cuando sí. Videasy y VidSrc dan 200 siempre
   * (resuelven en cliente) y Multiembed 403 de Cloudflare, que habla de quien
   * pregunta y no del título. Solo se marca lo verificado.
   */
  compruebaPorEstado?: boolean;
}

/**
 * Clave pública del generador de embeds de Vimeus, tal cual la comparten los
 * sitios que lo usan. Si algún día dejan de funcionar sus enlaces, es lo
 * primero que hay que regenerar desde su web.
 */
const CLAVE_VIMEUS = "mIO3kPK2Jk3hiOdw1bzXPDYYWvf-IgblslyRhziDhw";

/**
 * `Vimeus` carga `pop.js` (popunder) y `vast.js` (preroll VAST) desde
 * `vimeos.net` antes del vídeo. Sin bloqueador —AdBlock lo corta por reglas,
 * pero en una app de TV no hay reglas— sale una pestaña y un anuncio de 30 s
 * delante del contenido.
 *
 * Hubo un intento de arreglarlo con un proxy propio (`/api/proxy/vimeus`,
 * `/api/proxy/vimeos-asset`) que reescribía el HTML de `vimeus.com` quitando
 * esos dos guiones. Se desconectó: servir ese HTML reescrito desde nuestro
 * propio origen —en vez de `vimeus.com` cargado en un iframe cruzado, que es
 * como espera correr— dejó a JWPlayer sin reproducir nada. Las dos rutas
 * siguen en el repo por si se retoma, pero antes hay que resolver por qué
 * cambiar de origen rompe el reproductor, no solo limpiar los anuncios.
 */

/**
 * El orden es el producto: decide qué se ve al abrir una ficha. Vimeus primero
 * en películas (doblaje latino), VidSrc primero en series (los únicos
 * subtítulos de verdad), Videasy y Vidlink de relevo, Multiembed el último.
 *
 * ⚠️ El precio de VidSrc delante es su puerta antirrobot: subtítulos a cambio
 * de que a veces haya que pulsar «Probar otro servidor».
 */
const EMBED_PROVIDERS: Omit<EmbedProvider, "label">[] = [  {
    // El del doblaje latino. Solo películas — verificado 2026-08-24: /e/movie
    // → 200, y las siete variantes de serie probadas → 404.
    //
    // Ojo, `vimeos.net` es OTRO sitio: sus embeds llevan un hash opaco por
    // título resuelto en su backend, así que no se pueden armar por plantilla.
    id: "vimeus",
    movie: `https://vimeus.com/e/movie?tmdb={tmdbId}&view_key=${CLAVE_VIMEUS}&autoplay=1`,
    tv: "",
    spanishSubtitles: false,
    // Responde 404 cuando no tiene la película: por eso se puede preguntar.
    compruebaPorEstado: true,
  },
  {
    // El de los SUBTÍTULOS (`ds_lang=es`, verificado) y el primero en series.
    // Su puerta antirrobot es el precio; ver el comentario de orden arriba.
    id: "vidsrc",
    movie: "https://vidsrc.pm/embed/movie?tmdb={tmdbId}&ds_lang=es",
    tv: "https://vidsrc.pm/embed/tv?tmdb={tmdbId}&season={season}&episode={episode}&ds_lang=es",
    spanishSubtitles: true,
    // Verificado 2026-08-26 con la serie tmdb=123192 que lo destapó: anida
    // `nextgencloudfabric.com`, y ahí vive la puerta de Turnstile.
    puertaAntirrobot: true,
  },
  {
    // El relevo limpio: sin puerta antirrobot ni librerías de anuncios. No
    // trae subtítulos propios, por eso no encabeza.
    id: "videasy",
    movie: "https://player.videasy.to/movie/{tmdbId}",
    tv: "https://player.videasy.to/tv/{tmdbId}/{season}/{episode}",
    // Estaba en `true` sin comprobar. No los trae: ver el campo arriba.
    spanishSubtitles: false,
  },
  {
    // Sin puerta (verificado 2026-08-24), pero el que MÁS anuncios trae:
    // carga `aclib` (AdCash) y `processPopunderQueue`, que abre pestaña cada
    // 30 s. Los parámetros salen de su propio paquete, no de suponer:
    // `autoplay=true` arranca sin tocar el vídeo —clave con un mando— y
    // `poster=false` se salta un clic, o sea un popunder menos.
    id: "vidlink",
    movie: "https://vidlink.pro/movie/{tmdbId}?autoplay=true&poster=false",
    tv: "https://vidlink.pro/tv/{tmdbId}/{season}/{episode}?autoplay=true&poster=false",
    spanishSubtitles: false,
    // Responde 500 cuando no lo tiene.
    compruebaPorEstado: true,
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

/** Proveedor propio por entorno: apuntar a otro servidor sin recompilar. */
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
 * Lista disponible, con el propio delante. Se descarta el de la lista fija que
 * apunte a su mismo dominio: si no, salen dos botones idénticos y al fallar se
 * prueba dos veces lo mismo.
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

/**
 * Reordena dejando al final los proveedores con puerta antirrobot.
 *
 * SOLO para televisores. En un teléfono o un ordenador esas puertas se pasan
 * solas y VidSrc va delante, con sus subtítulos, como debe. En un televisor la
 * puerta no pasa y el marco se recarga sin fin: ahí sus subtítulos no existen
 * de verdad, porque no llega a haber vídeo.
 *
 * Se ordenan, no se quitan, y la ficha etiqueta cuál trae subtítulos para que
 * la elección se vea. Quitarlos en silencio fue el error de la vez anterior.
 */
export function ordenarParaTelevisor<T extends { puertaAntirrobot?: boolean }>(
  proveedores: T[],
): T[] {
  return [
    ...proveedores.filter((proveedor) => !proveedor.puertaAntirrobot),
    ...proveedores.filter((proveedor) => proveedor.puertaAntirrobot),
  ];
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

/**
 * URL que se carga en el iframe. Siempre la real —ver el comentario de
 * arriba sobre por qué el proxy de Vimeus está desconectado—. Devuelve
 * `null` si no se puede armar (igual que `buildEmbedUrl`).
 */
export function buildIframeUrl(
  provider: EmbedProvider,
  mediaType: MediaType,
  target: EmbedTarget
): string | null {
  return buildEmbedUrl(provider, mediaType, target);
}

/**
 * Los servidores embed de un título, sin numerar.
 *
 * Vivía repetido en `/api/stream` y hacía falta también en la ficha, que es
 * quien decide **qué se ve en el primer fotograma**. Dos copias de esta lista
 * es exactamente cómo se acaba enseñando un servidor distinto del que dice el
 * botón.
 *
 * Sin numerar a propósito: las etiquetas se ponen después de descartar los que
 * no tienen el título (ver `disponibilidad.ts`), o quedarían huecos —«Servidor
 * 1, 3, 4»— que parecen botones rotos.
 */
export function servidoresEmbed(
  mediaType: MediaType,
  target: EmbedTarget,
  enTelevisor: boolean,
): ServidorEmbed[] {
  const lista = enTelevisor ? ordenarParaTelevisor(getProviders()) : getProviders();
  return lista.flatMap((provider) => {
    const url = buildEmbedUrl(provider, mediaType, target);
    const urlEmbed = buildIframeUrl(provider, mediaType, target);
    return url
      ? [{
          id: provider.id,
          label: provider.label,
          url,
          urlEmbed: urlEmbed ?? url,
          puertaAntirrobot: provider.puertaAntirrobot,
          subtitulos: provider.spanishSubtitles,
          compruebaPorEstado: provider.compruebaPorEstado,
        }]
      : [];
  });
}

/** Lo que `servidoresEmbed` devuelve, con la etiqueta aún provisional. */
export interface ServidorEmbed {
  id: string;
  label: string;
  url: string;
  /**
   * Lo que va al `src` del iframe. En general coincide con `url`, pero en
   * `vimeus` apunta al proxy propio que limpia los scripts de anuncios antes
   * de entregar el HTML. `disponibilidad.ts` debe seguir usando `url`, que es
   * la real y sobre la que el proveedor responde 404 cuando no tiene el
   * título.
   */
  urlEmbed?: string;
  puertaAntirrobot?: boolean;
  subtitulos?: boolean;
  compruebaPorEstado?: boolean;
}

/**
 * «Servidor 1, 2, 3…» de corrido, después de todos los descartes.
 *
 * El proveedor propio conserva su nombre: quien lo configura sabe cuál es y
 * llamarlo «Servidor 2» lo escondería entre los demás.
 */
export function numerarServidores<T extends { id: string; label: string }>(servidores: T[]): T[] {
  let numero = 0;
  return servidores.map((servidor) =>
    servidor.id === "propio" ? servidor : { ...servidor, label: `Servidor ${++numero}` },
  );
}
