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

/** Reglas en orden: la primera que coincide gana. */
const CATEGORY_RULES: { category: string; pattern: RegExp }[] = [
  { category: "Guatemala", pattern: /\b(gt|guatemal\w*|chapin\w*|canal ?3|canal ?7|canal ?11|canal ?13|tn23|totovision|guatevision|tigo sports)\b/ },
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

export function classifyChannel(searchableText: string): string {
  const normalized = normalizeText(searchableText);
  for (const { category, pattern } of CATEGORY_RULES) {
    if (pattern.test(normalized)) return category;
  }
  for (const { category, pattern } of LANGUAGE_RULES) {
    if (pattern.test(normalized)) return category;
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
 * Paleta por categoría. Las clases van completas (nunca interpoladas) para que
 * Tailwind las conserve al compilar.
 */
export interface CategoryStyle {
  chip: string;
  dot: string;
  ring: string;
  tint: string;
  text: string;
}

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  Guatemala: { chip: "bg-gradient-to-r from-teal-600 to-emerald-600", dot: "bg-teal-500", ring: "ring-teal-400", tint: "bg-teal-50", text: "text-teal-600" },
  Deportes: { chip: "bg-gradient-to-r from-orange-500 to-amber-500", dot: "bg-orange-500", ring: "ring-orange-400", tint: "bg-orange-50", text: "text-orange-600" },
  Noticias: { chip: "bg-gradient-to-r from-sky-600 to-blue-600", dot: "bg-sky-500", ring: "ring-sky-400", tint: "bg-sky-50", text: "text-sky-600" },
  "Películas y series": { chip: "bg-gradient-to-r from-violet-600 to-purple-600", dot: "bg-violet-500", ring: "ring-violet-400", tint: "bg-violet-50", text: "text-violet-600" },
  Documentales: { chip: "bg-gradient-to-r from-amber-600 to-yellow-600", dot: "bg-amber-500", ring: "ring-amber-400", tint: "bg-amber-50", text: "text-amber-600" },
  Infantil: { chip: "bg-gradient-to-r from-pink-500 to-rose-500", dot: "bg-pink-500", ring: "ring-pink-400", tint: "bg-pink-50", text: "text-pink-600" },
  Música: { chip: "bg-gradient-to-r from-fuchsia-600 to-pink-600", dot: "bg-fuchsia-500", ring: "ring-fuchsia-400", tint: "bg-fuchsia-50", text: "text-fuchsia-600" },
  Religión: { chip: "bg-gradient-to-r from-indigo-600 to-blue-600", dot: "bg-indigo-500", ring: "ring-indigo-400", tint: "bg-indigo-50", text: "text-indigo-600" },
  Entretenimiento: { chip: "bg-gradient-to-r from-rose-500 to-red-500", dot: "bg-rose-500", ring: "ring-rose-400", tint: "bg-rose-50", text: "text-rose-600" },
};

const DEFAULT_CATEGORY_STYLE: CategoryStyle = {
  chip: "bg-gradient-to-r from-slate-600 to-slate-700",
  dot: "bg-slate-400",
  ring: "ring-slate-400",
  tint: "bg-slate-100",
  text: "text-slate-600",
};

export function getCategoryStyle(category: string): CategoryStyle {
  return CATEGORY_STYLES[category] ?? DEFAULT_CATEGORY_STYLE;
}
