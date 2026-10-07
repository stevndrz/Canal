/**
 * De qué va un canal: su tema.
 *
 * Sustituye, para lo que se ENSEÑA, a la categoría de `categories.ts`. Aquella
 * mezclaba tres preguntas en una —¿de dónde es?, ¿en qué idioma?, ¿de qué
 * va?— y lo que no contestaba ninguna acababa en «Internacional»: 2.267
 * canales, casi la mitad de la lista, en un cajón que solo quería decir «no
 * sé». El país vive ahora en `origenes.ts`; aquí solo queda el tema.
 *
 * **La lista ya lo trae.** Las M3U de iptv-org llevan el tema en
 * `group-title` («News», «Sports», «Kids;Religious»…): tres de cada cuatro
 * canales lo dicen. Antes se ignoraba y se adivinaba con expresiones regulares
 * sobre el nombre. Ahora manda la lista, y el nombre queda de respaldo para los
 * «Undefined» y para las listas que traen otra cosa en ese campo.
 */

import { normalizeText } from "./text";

/**
 * Los temas, en el orden en que se ordena DENTRO de cada sección de Canales:
 * los generalistas primero —son los que la gente busca por su nombre—, y lo
 * menos visto al final.
 */
export const TEMAS = [
  "Generalista",
  "Noticias",
  "Deportes",
  "Infantil",
  "Películas y series",
  "Variedades",
  "Documentales",
  "Música",
  "Religión",
  "Institucional",
  "Compras",
  "Otros",
] as const;

export type Tema = (typeof TEMAS)[number];

/**
 * `group-title` → tema. Las claves van normalizadas (minúsculas, sin tildes).
 *
 * Con las de iptv-org en inglés y también en español: una lista hecha a mano
 * suele traer «Deportes» o «Noticias» en ese campo, y no por eso hay que
 * tirarla al respaldo por nombre.
 *
 * Lo que NO es un tema no está: «Guatemala», «Latino» o «Español» en
 * `group-title` dicen de dónde es o en qué habla, y eso lo resuelve
 * `origenes.ts`. Si aparecen, se cae al nombre.
 */
const TEMA_DE_GRUPO: Record<string, Tema> = {
  general: "Generalista",
  generalista: "Generalista",
  news: "Noticias",
  weather: "Noticias",
  noticias: "Noticias",
  informativos: "Noticias",
  sports: "Deportes",
  sport: "Deportes",
  deportes: "Deportes",
  kids: "Infantil",
  animation: "Infantil",
  infantil: "Infantil",
  ninos: "Infantil",
  movies: "Películas y series",
  movie: "Películas y series",
  series: "Películas y series",
  classic: "Películas y series",
  cine: "Películas y series",
  peliculas: "Películas y series",
  "peliculas y series": "Películas y series",
  documentary: "Documentales",
  education: "Documentales",
  science: "Documentales",
  culture: "Documentales",
  documentales: "Documentales",
  cultura: "Documentales",
  educacion: "Documentales",
  music: "Música",
  musica: "Música",
  religious: "Religión",
  religion: "Religión",
  religioso: "Religión",
  entertainment: "Variedades",
  comedy: "Variedades",
  lifestyle: "Variedades",
  travel: "Variedades",
  cooking: "Variedades",
  auto: "Variedades",
  outdoor: "Variedades",
  family: "Variedades",
  relax: "Variedades",
  business: "Variedades",
  entretenimiento: "Variedades",
  variedades: "Variedades",
  legislative: "Institucional",
  public: "Institucional",
  institucional: "Institucional",
  shop: "Compras",
  compras: "Compras",
};

/**
 * Con varios temas («Kids;Religious»), gana el que va antes en ESTE orden, que
 * es el de la tabla del informe y no el de `TEMAS`: un canal «General;News» es
 * un generalista con informativos, no un canal de noticias, y uno
 * «Entertainment;Sports» se busca en Deportes antes que en Variedades.
 */
const PRIORIDAD_ENTRE_TEMAS: readonly Tema[] = [
  "Generalista",
  "Noticias",
  "Deportes",
  "Infantil",
  "Películas y series",
  "Documentales",
  "Música",
  "Religión",
  "Variedades",
  "Institucional",
  "Compras",
];

/**
 * El tema que declara la lista, o `null` si no declara ninguno que entendamos
 * («Undefined», vacío, o algo que no es un tema).
 */
export function temaDeGrupo(grupo: string): Tema | null {
  const encontrados = grupo
    .split(/[;,|/]/)
    .map((trozo) => TEMA_DE_GRUPO[normalizeText(trozo).trim()])
    .filter((tema): tema is Tema => Boolean(tema));
  if (encontrados.length === 0) return null;
  for (const tema of PRIORIDAD_ENTRE_TEMAS) {
    if (encontrados.includes(tema)) return tema;
  }
  return encontrados[0];
}

/**
 * Respaldo por nombre, para los canales que no traen tema.
 *
 * Son las reglas de siempre de `categories.ts` con dos bajas a propósito:
 * - fuera `bbc|public|legislative` de Noticias, que metía «BBC Comedy» y
 *   «3Cat Càmeres» entre los informativos;
 * - fuera las reglas de idioma: «Español» o «Inglés» no dicen de qué va un
 *   canal.
 */
const REGLAS_POR_NOMBRE: { tema: Tema; patron: RegExp }[] = [
  { tema: "Deportes", patron: /\b(sport|sports|deporte|deportes|futbol|football|soccer|nba|nfl|mlb|tennis|ufc|espn|fox sports|tudn)\b/ },
  { tema: "Noticias", patron: /\b(news|noticias|noticiero|cnn|dw|teleprensa|telediario)\b/ },
  { tema: "Películas y series", patron: /\b(movie|movies|cine|pelicula|peliculas|series|film|films|classic|cinemax|hbo|cinecanal)\b/ },
  { tema: "Documentales", patron: /\b(documentary|documental|documentales|culture|cultura|science|ciencia|education|educativo|history|historia)\b/ },
  { tema: "Infantil", patron: /\b(kids|kid|infantil|ninos|cartoon|cartoons|disney|nick|boomerang|animation|animacion)\b/ },
  { tema: "Música", patron: /\b(music|musica|radio|mtv)\b/ },
  { tema: "Religión", patron: /\b(religion|religious|religioso|iglesia|dios|peniel|bethel|rhema|cristo|biblia)\b/ },
  { tema: "Variedades", patron: /\b(entertainment|entretenimiento|variedades|lifestyle|travel|viajes|outdoor|auto|business|comedy|comedia)\b/ },
];

export function temaPorNombre(nombre: string): Tema {
  const normalizado = normalizeText(nombre);
  for (const { tema, patron } of REGLAS_POR_NOMBRE) {
    if (patron.test(normalizado)) return tema;
  }
  return "Otros";
}

/** El tema de un canal: lo que diga la lista y, si no dice nada, su nombre. */
export function temaDeCanal({ nombre, grupo = "" }: { nombre: string; grupo?: string }): Tema {
  return temaDeGrupo(grupo) ?? temaPorNombre(nombre);
}

/** ¿Es una de las doce? Lo que llega por la red se comprueba antes de usarlo. */
export function esTema(valor: string): valor is Tema {
  return (TEMAS as readonly string[]).includes(valor);
}

/** Posición del tema en `TEMAS`; lo desconocido, al final. */
export function ordenDeTema(tema: string): number {
  const indice = (TEMAS as readonly string[]).indexOf(tema);
  return indice === -1 ? TEMAS.length : indice;
}

/**
 * Los chips de la cabecera de Canales, en el orden del informe. Generalista no
 * tiene chip propio —es «la tele de siempre», lo que se ve en Todo— y los tres
 * de la cola van detrás de «Más».
 */
export const TEMAS_CON_CHIP: readonly Tema[] = [
  "Noticias",
  "Deportes",
  "Infantil",
  "Películas y series",
  "Variedades",
  "Música",
  "Documentales",
  "Religión",
];

export const TEMAS_DE_MAS: readonly Tema[] = ["Generalista", "Institucional", "Compras", "Otros"];

/**
 * Para la URL (`?tema=deportes`) y para los atributos `data-*`: sin espacios
 * ni tildes, y reversible.
 */
export function claveDeTema(tema: Tema): string {
  return normalizeText(tema).replace(/\s+/g, "-");
}

export function temaDeClave(clave: string): Tema | null {
  return TEMAS.find((tema) => claveDeTema(tema) === clave) ?? null;
}
