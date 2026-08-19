import type { MediaType } from "./types";

/**
 * Proveedores de reproducción por iframe.
 *
 * Las URL no se incrustan en el código a propósito: se configuran por entorno,
 * así se cambia de proveedor (o se apunta a un servidor propio) sin tocar ni
 * recompilar nada. Si no hay ninguno configurado, la ficha lo dice con un
 * mensaje claro en vez de mostrar un marco en blanco.
 *
 * Marcadores admitidos en la plantilla: {tmdbId} {season} {episode}
 * Ejemplo: https://mi-proveedor/embed/movie/{tmdbId}
 */

export interface EmbedTarget {
  tmdbId: number;
  season?: number;
  episode?: number;
}

function template(mediaType: MediaType): string {
  return mediaType === "movie"
    ? process.env.NEXT_PUBLIC_EMBED_PROVIDER_MOVIE ?? ""
    : process.env.NEXT_PUBLIC_EMBED_PROVIDER_TV ?? "";
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
