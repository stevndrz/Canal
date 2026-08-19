/** Normalizaciones de texto compartidas por el parser M3U, el EPG y los logos. */

/** Minúsculas y sin acentos, conservando espacios y puntuación. */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Clave para emparejar el mismo canal entre fuentes distintas (lista M3U,
 * guía XMLTV, índice de logos): sin acentos, sin puntuación y sin sufijos de
 * calidad, conservando letras y números de cualquier alfabeto para que también
 * funcione con nombres no latinos.
 *
 * Debe mantenerse alineada con la función homónima de scripts/build-logo-index.mjs.
 */
export function normalizeChannelName(value: string): string {
  const cleaned = normalizeText(value).replace(/\b(hd|fhd|uhd|4k|sd)\b/g, " ");
  return Array.from(cleaned)
    .filter((character) => /\p{L}|\p{N}/u.test(character))
    .join("");
}

/** Formas progresivamente más simples del nombre, de la más específica a la más general. */
export function channelNameVariants(name: string): string[] {
  const variants = [name];
  const withoutParens = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (withoutParens && withoutParens !== name) variants.push(withoutParens);
  return variants;
}
