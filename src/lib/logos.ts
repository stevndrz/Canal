import logoIndex from "./logo-index.json";
import { channelNameVariants, normalizeChannelName } from "./text";

/**
 * Resolución de logos por nombre de canal.
 *
 * Ninguna lista M3U garantiza traer `tvg-logo` (la actual no lo trae), así que
 * cuando falta se busca el nombre del canal en un índice local generado desde
 * la base de datos de iptv-org (ver scripts/build-logo-index.mjs). Cubre ~73%
 * de los canales de listas públicas reales; el resto cae al monograma de color
 * de su categoría, sin romper nada.
 */

const ALPHA = "0123456789abcdefghijklmnopqrstuvwxyz";

const { prefixes, suffixes, logos } = logoIndex as {
  prefixes: string[];
  suffixes: string[];
  logos: Record<string, string>;
};

/** Revierte la sustitución de prefijo/sufijo que aplica el script generador. */
function decodeUrl(encoded: string): string {
  const prefix = prefixes[ALPHA.indexOf(encoded[0])] ?? "";
  const suffix = suffixes[ALPHA.indexOf(encoded[1])] ?? "";
  return prefix + encoded.slice(2) + suffix;
}

/** URL del logo para ese nombre de canal, o "" si no hay ninguno. */
export function findLogoUrl(channelName: string): string {
  for (const variant of channelNameVariants(channelName)) {
    const key = normalizeChannelName(variant);
    if (key.length < 3) continue;
    const encoded = logos[key];
    if (encoded) return decodeUrl(encoded);
  }
  return "";
}
