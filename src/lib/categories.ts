/**
 * Clasificación de canales y estilo visual por categoría.
 *
 * Las listas M3U públicas grandes suelen traer `group-title` en inglés y sin
 * `tvg-country`/`tvg-id`, así que la clasificación se apoya sobre todo en el
 * nombre del canal y ese `group-title`.
 */

import { normalizeText } from "./text";

export const CATEGORY_ORDER = [
  "Guatemala",
  "Deportes",
  "Noticias",
  "Películas y series",
  "Documentales",
  "Infantil",
  "Música",
  "Religión",
  "Entretenimiento",
  "Español",
  "Inglés",
  "Internacional",
  "General",
] as const;

/**
 * Señales inequívocas de canal guatemalteco: pueden aparecer en cualquier parte
 * del texto sin riesgo de confundirse con canales de otros países.
 */
const GUATEMALA_SIGNALS = /\b(guatemal\w*|chapin\w*|guatevision|tn ?23|totovision|tigo ?sports)\b/;

/**
 * Nombres genéricos que SOLO cuentan si el canal se llama exactamente así.
 * Media Latinoamérica tiene un "Canal 3" o un "Canal 13" (Formosa, Jujuy,
 * Chiapas, Boaco...), así que buscarlos como subcadena llenaba la categoría
 * Guatemala de canales de otros países.
 */
const GUATEMALA_EXACT_NAMES = /^(canal ?[3789]|canal ?1[13]|canal ?2[07]|canal ?11 tutv)$/;

/** Reglas en orden: la primera que coincide gana. */
const CATEGORY_RULES: { category: string; pattern: RegExp }[] = [
  { category: "Deportes", pattern: /\b(sport|sports|deporte|deportes|futbol|football|soccer|nba|nfl|mlb|tennis|ufc|espn|fox sports)\b/ },
  { category: "Noticias", pattern: /\b(news|noticias|noticiero|cnn|bbc|dw|teleprensa|legislative|public)\b/ },
  { category: "Películas y series", pattern: /\b(movie|movies|cine|pelicula|peliculas|series|film|films|classic|cinemax|hbo|cinecanal)\b/ },
  { category: "Documentales", pattern: /\b(documentary|documental|documentales|culture|cultura|science|ciencia|education|educativo|history|historia)\b/ },
  { category: "Infantil", pattern: /\b(kids|kid|infantil|ninos|cartoon|disney|nick|boomerang|animation|animacion)\b/ },
  { category: "Música", pattern: /\b(music|musica|radio|mtv)\b/ },
  { category: "Religión", pattern: /\b(religion|religious|religioso|iglesia|dios|peniel|bethel|rhema|cristo|biblia)\b/ },
  { category: "Entretenimiento", pattern: /\b(entertainment|entretenimiento|variedades|lifestyle|travel|viajes|outdoor|auto|business|comedy|comedia)\b/ },
];

const LANGUAGE_RULES: { category: string; pattern: RegExp }[] = [
  { category: "Inglés", pattern: /\b(english|ingles|usa|united states|uk|britain|canada)\b/ },
  { category: "Español", pattern: /\b(espanol|spanish|latino|latin|mexico|colombia|argentina|chile|peru|espana)\b/ },
];

export interface ChannelClassificationInput {
  name: string;
  group?: string;
  country?: string;
  language?: string;
}

export function classifyChannel({ name, group = "", country = "", language = "" }: ChannelClassificationInput): string {
  const normalizedName = normalizeText(name).trim();
  const normalizedCountry = normalizeText(country).trim();
  const haystack = normalizeText(`${name} ${group} ${country} ${language}`);

  // Guatemala se evalúa primero y con reglas propias: es la categoría
  // prioritaria y la que más se contamina si se adivina por el nombre.
  //
  // Cuando la lista dice de qué país es el canal (por `tvg-country` o por el
  // sufijo del `tvg-id`, ej. `Canal3.gt@SD`), esa información manda y el
  // nombre no se consulta: así "Tigo Sports" de Bolivia o "Canal 3" de
  // Formosa no acaban en la categoría de Guatemala.
  if (normalizedCountry) {
    return /\bgt\b/.test(normalizedCountry) ? "Guatemala" : classifyByContent(haystack);
  }
  if (GUATEMALA_SIGNALS.test(haystack) || GUATEMALA_EXACT_NAMES.test(normalizedName)) {
    return "Guatemala";
  }
  return classifyByContent(haystack);
}

/** Resto de categorías, ya descartada Guatemala. */
function classifyByContent(haystack: string): string {
  for (const { category, pattern } of CATEGORY_RULES) {
    if (pattern.test(haystack)) return category;
  }
  for (const { category, pattern } of LANGUAGE_RULES) {
    if (pattern.test(haystack)) return category;
  }
  return "Internacional";
}

export function compareByCategory(a: string, b: string): number {
  const indexA = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number]);
  const indexB = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number]);
  // Categorías desconocidas van al final, no al principio.
  return (indexA === -1 ? CATEGORY_ORDER.length : indexA) - (indexB === -1 ? CATEGORY_ORDER.length : indexB);
}

/**
 * Canales guatemaltecos principales, en el orden en que deben aparecer en el
 * acceso rápido. Se emparejan por nombre; los que no estén en la lista M3U
 * cargada simplemente no aparecen.
 */
export const FEATURED_CHANNEL_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: "Canal 3", pattern: /^canal ?3$|^tres$|^trecevision$/ },
  { label: "Canal 7", pattern: /^canal ?7$|^siete$|^televisiete$/ },
  { label: "Guatevisión", pattern: /guatevision/ },
  { label: "TN23", pattern: /^tn ?23$/ },
  { label: "Canal 11", pattern: /^canal ?11$/ },
  { label: "Canal 13", pattern: /^canal ?13$/ },
  { label: "Tigo Sports", pattern: /tigo ?sports/ },
  { label: "Canal 27", pattern: /^canal ?27$/ },
  { label: "TV Azteca Guate", pattern: /azteca ?guate/ },
  { label: "Totovisión", pattern: /totovision/ },
];

/**
 * Canales que deben salir primero dentro de su categoría, en este orden.
 *
 * La lista M3U trae miles de canales y el número que traiga cada uno no dice
 * nada de lo que la gente quiere ver: hay decenas de "Canal 5" de países
 * distintos. Aquí manda la importancia real, no el número.
 *
 * Guatemala reutiliza `FEATURED_CHANNEL_PATTERNS`, que ya define ese orden para
 * el acceso rápido: tener dos listas del mismo país acabaría con una
 * desactualizada respecto a la otra.
 */
const CHANNEL_PRIORITY: Record<string, RegExp[]> = {
  Guatemala: FEATURED_CHANNEL_PATTERNS.map((featured) => featured.pattern),
  Deportes: [
    /^espn$|^espn ?1$/,
    /^espn ?2$/,
    /^espn ?3$|^espn ?deportes$/,
    /tudn/,
    // Tigo Sports pasó a llamarse Fox y Fox+ en Guatemala en mayo de 2026, así
    // que la lista puede traer cualquiera de los dos nombres.
    /tigo ?sports|^fox ?sports|^fox\+?$/,
    /tnt ?sports/,
    /sky ?sports/,
    /^win ?sports/,
  ],
  "Películas y series": [
    /^hbo$|^hbo ?2$/,
    /cinemax/,
    /^tnt$|^tnt ?hd$/,
    /star ?channel|^fox$/,
    /^space$/,
    /cinecanal/,
    /^warner|warner ?channel/,
    /^amc$/,
    /^tcm$/,
    /studio ?universal/,
    /^sony$|sony ?channel/,
    /^axn$/,
  ],
  Noticias: [
    /cnn ?(en )?espanol/,
    /^cnn$/,
    /^bbc/,
    /^dw$|deutsche ?welle/,
    /telesur/,
    /france ?24/,
  ],
  Infantil: [
    /cartoon ?network/,
    /disney ?channel/,
    /nickelodeon|^nick$/,
    /discovery ?kids/,
    /boomerang/,
  ],
};

/**
 * Posición del canal dentro de la lista de importantes de su categoría.
 * Devuelve un número grande si no está, para que caiga detrás de todos ellos.
 */
export function priorityRank(name: string, category: string): number {
  const patterns = CHANNEL_PRIORITY[category];
  if (!patterns) return Number.MAX_SAFE_INTEGER;

  const normalized = normalizeText(name);
  const index = patterns.findIndex((pattern) => pattern.test(normalized));
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
