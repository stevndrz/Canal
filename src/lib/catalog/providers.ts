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
 * migró de .net a .to, vidsrc.pm murió en octubre de 2026). Si varios fallan
 * a la vez con error de DNS, comprobar
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
   * Hoy ninguno: el único que los traía de verdad era VidSrc (`ds_lang=es`),
   * retirado en octubre de 2026 porque su dominio murió.
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
   * Comprobado con curl contra ids reales: Vimeus da 404 cuando no lo tiene,
   * 200 cuando sí. Vidzee y Vidrock dan 200 siempre (resuelven en cliente) y
   * Multiembed redirige a un reto de Cloudflare, que habla de quien pregunta y
   * no del título. Solo se marca lo verificado.
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
 * Hubo un intento de arreglarlo con un proxy propio que reescribía el HTML
 * de `vimeus.com` quitando esos dos guiones. Rompía JWPlayer (servirlo desde
 * nuestro origen y no desde el suyo lo dejaba sin reproducir) y se retiró del
 * todo el 2026-10-08: dos rutas públicas sin usar eran solo superficie de
 * abuso. El dueño acepta los anuncios de Vimeus a cambio de que funcione.
 */

/**
 * El orden es el producto: decide qué se ve al abrir una ficha.
 *
 * Revisado el 2026-10-08 a petición del dueño, que en su casa solo veía
 * funcionar Vimeus (doblaje latino) y «el último» (Multiembed):
 *
 * 1. **Vimeus**: el principal, por el doblaje latino. Solo películas.
 * 2. **Vidzee**: la recaída, en inglés. Comprobado con un navegador de verdad
 *    que llega al vídeo (descarga la lista HLS y los segmentos, y sabe la
 *    duración exacta: Inception 2:28:07, Dune 2 2:45:48), y el dueño confirmó
 *    el mismo día que es el que le reproduce en el teléfono. Cubre series, así
 *    que en ellas —y en las películas que Vimeus no tiene— es el primero.
 * 3. **Multiembed**: detrás de una puerta de Cloudflare. Era el segundo.
 * 4. **Vidrock**: como Vidzee, pero no aguanta el `sandbox` contra pop-ups.
 *
 * Retirados ese mismo día, comprobado:
 * - `vidsrc.pm` responde «Not found» incluso con Inception o Dune: dominio
 *   muerto. La familia VidSrc sigue viva en `vidsrc.sh`, pero detrás de una
 *   puerta que en la prueba no dejó ver nada; era el único con subtítulos en
 *   español y de momento no hay sustituto comprobado.
 * - Videasy (`player.videasy.to`) devuelve «Access denied».
 * - Vidlink carga su reproductor, pero el servidor de vídeo responde 428 y no
 *   entrega nada.
 *
 * Cómo volver a probarlos: abrir el embed en un navegador y mirar en la
 * pestaña de red si llega un `.m3u8` con 200. Un 200 de la página del embed
 * no significa nada: casi todos lo dan aunque luego fallen por dentro.
 */
const EMBED_PROVIDERS: Omit<EmbedProvider, "label">[] = [
  {
    // El del doblaje latino. Solo películas — verificado 2026-08-24: /e/movie
    // → 200, y las siete variantes de serie probadas → 404.
    //
    // Ojo, `vimeos.net` es OTRO sitio: sus embeds llevan un hash opaco por
    // título resuelto en su backend, así que no se pueden armar por plantilla.
    // Es el reproductor que Vimeus carga por dentro («S1 vimeos.net»).
    id: "vimeus",
    movie: `https://vimeus.com/e/movie?tmdb={tmdbId}&view_key=${CLAVE_VIMEUS}&autoplay=1`,
    tv: "",
    spanishSubtitles: false,
    // Responde 404 cuando no tiene la película: por eso se puede preguntar.
    compruebaPorEstado: true,
  },
  {
    // La recaída: segundo con Vimeus y primero cuando Vimeus no tiene el
    // título (y en todas las series). El dueño confirmó el 2026-10-08 que es
    // el que de verdad le reproduce en el teléfono.
    //
    // Manda `frame-ancestors *`, así que se deja meter en
    // el iframe aunque también envíe `X-Frame-Options: SAMEORIGIN` (los
    // navegadores dan prioridad al primero). Responde 200 siempre: no se puede
    // preguntar si tiene el título.
    id: "vidzee",
    movie: "https://player.vidzee.wtf/embed/movie/{tmdbId}",
    tv: "https://player.vidzee.wtf/embed/tv/{tmdbId}/{season}/{episode}",
    spanishSubtitles: false,
  },
  {
    // Detrás de una comprobación de Cloudflare (verificado: 403 con reto
    // desde un servidor), que en un teléfono o un PC se pasa sola. Era la
    // recaída hasta que el dueño confirmó que el que le funciona es Vidzee.
    id: "multiembed",
    movie: "https://multiembed.mov/?video_id={tmdbId}&tmdb=1",
    tv: "https://multiembed.mov/?video_id={tmdbId}&tmdb=1&season={season}&episode={episode}",
    spanishSubtitles: false,
    puertaAntirrobot: true,
  },
  {
    // Nuevo (2026-10-08). Subtítulos solo en inglés en su caché.
    id: "vidrock",
    movie: "https://vidrock.net/movie/{tmdbId}",
    tv: "https://vidrock.net/tv/{tmdbId}/{season}/{episode}",
    spanishSubtitles: false,
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
 * solas y Multiembed conserva su sitio. En un televisor la puerta no pasa
 * y el marco se recarga sin fin: ahí sus subtítulos no existen de verdad,
 * porque no llega a haber vídeo.
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
