import type { MediaType } from "./types";

/**
 * Proveedores de reproducción por iframe.
 *
 * Se pueden configurar por entorno para cambiar de proveedor (o apuntar a un
 * servidor propio) sin recompilar, pero hay un valor por defecto para que la
 * app funcione recién clonada, sin preparar nada.
 *
 * Que estén aquí escritas no expone nada: estas variables llevan el prefijo
 * `NEXT_PUBLIC_`, así que Next las incrusta en el JavaScript que descarga el
 * navegador. Son públicas mirando el código o mirando la pestaña de red del
 * navegador: da igual. Las credenciales de verdad (Pusher, TMDB) no llevan ese
 * prefijo y nunca salen del servidor.
 *
 * Marcadores admitidos en la plantilla: {tmdbId} {season} {episode}
 * Ejemplo: https://mi-proveedor/embed/movie/{tmdbId}
 */

/**
 * Proveedor por defecto. `ds_lang=es` le pide subtítulos en español, que es lo
 * que hace mirable el cine en inglés sin tocar nada a media película.
 *
 * Si algún día deja de responder hay espejos (vidsrc.xyz, vidsrc.in,
 * vidsrc.me): se cambia el dominio aquí, o se define la variable de entorno
 * para no tocar el código.
 */
const DEFAULT_TEMPLATE: Record<MediaType, string> = {
  movie: "https://vidsrc.pm/embed/movie?tmdb={tmdbId}&ds_lang=es",
  tv: "https://vidsrc.pm/embed/tv?tmdb={tmdbId}&season={season}&episode={episode}&ds_lang=es",
};

export interface EmbedTarget {
  tmdbId: number;
  season?: number;
  episode?: number;
}

function template(mediaType: MediaType): string {
  const configured =
    mediaType === "movie"
      ? process.env.NEXT_PUBLIC_EMBED_PROVIDER_MOVIE
      : process.env.NEXT_PUBLIC_EMBED_PROVIDER_TV;
  // `||` y no `??`: una variable definida pero vacía (lo más común al
  // configurarlas mal) debe caer al valor por defecto, no dejar la ficha muerta.
  return configured?.trim() || DEFAULT_TEMPLATE[mediaType];
}

export function isEmbedConfigured(mediaType: MediaType): boolean {
  return template(mediaType).trim().length > 0;
}

/** Devuelve la URL del iframe, o null si falta configuración o el tmdbId. */
export function buildEmbedUrl(mediaType: MediaType, target: EmbedTarget): string | null {
  const pattern = template(mediaType).trim();
  if (!pattern || !target.tmdbId) return null;

  const url = pattern
    .replace("{tmdbId}", String(target.tmdbId))
    .replace("{season}", String(target.season ?? 1))
    .replace("{episode}", String(target.episode ?? 1));

  // Solo http(s): evita que una plantilla mal escrita acabe en javascript:
  return /^https?:\/\//i.test(url) ? url : null;
}
