/** Normalizaciones de texto compartidas por el parser M3U, el EPG y los logos. */

/**
 * Las expresiones, una sola vez y fuera de las funciones.
 *
 * No es estilo: en Chromium < 64 (los televisores de 2019) `\p{…}` no existe,
 * y la compilación lo traduce a un `RegExp` con una clase de caracteres
 * gigante. Escrita dentro de la función —y peor, dentro del `filter`, una por
 * LETRA— se reconstruía decenas de miles de veces al indexar la lista: la
 * tele se quedaba colgada minutos (medido en Chromium 59). Aquí se construye
 * una vez al cargar el módulo.
 */
const DIACRITICOS = /\p{Diacritic}/gu;
const SUFIJOS_DE_CALIDAD = /\b(hd|fhd|uhd|4k|sd)\b/g;
const LETRA_O_NUMERO = /[\p{L}\p{N}]/u;
const SOLO_ASCII = /^[\x00-\x7f]*$/;
/** Los únicos diacríticos de Unicode que caen dentro de ASCII. */
const DIACRITICOS_ASCII = /[\^`]/g;

/**
 * Minúsculas y sin acentos, conservando espacios y puntuación.
 *
 * Camino rápido para ASCII, que es casi toda la lista: ahí `NFD` no cambia
 * nada y los únicos diacríticos son `^` y `` ` ``. La clase `\p{Diacritic}`,
 * compilada para las teles viejas, es una lista de cientos de rangos; pasarla
 * por 4.816 nombres costaba medio segundo de CPU en un televisor. Mismo
 * resultado exacto: lo comprueba `text.test.ts` contra la versión directa.
 */
export function normalizeText(value: string): string {
  if (SOLO_ASCII.test(value)) return value.replace(DIACRITICOS_ASCII, "").toLowerCase();
  return value.normalize("NFD").replace(DIACRITICOS, "").toLowerCase();
}

/** ¿Letra o número de cualquier alfabeto? Con atajo para ASCII, por lo mismo. */
function esLetraONumero(caracter: string): boolean {
  const codigo = caracter.charCodeAt(0);
  if (codigo < 128) {
    return (codigo >= 48 && codigo <= 57) || (codigo >= 65 && codigo <= 90) || (codigo >= 97 && codigo <= 122);
  }
  return LETRA_O_NUMERO.test(caracter);
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
  const cleaned = normalizeText(value).replace(SUFIJOS_DE_CALIDAD, " ");
  let resultado = "";
  for (const caracter of Array.from(cleaned)) {
    if (esLetraONumero(caracter)) resultado += caracter;
  }
  return resultado;
}

/** Formas progresivamente más simples del nombre, de la más específica a la más general. */
export function channelNameVariants(name: string): string[] {
  const variants = [name];
  const withoutParens = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (withoutParens && withoutParens !== name) variants.push(withoutParens);
  return variants;
}
