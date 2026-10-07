/**
 * De dónde es un canal, y en qué sección de Canales vive por eso.
 *
 * La idea rectora de la pantalla es «lo mío → lo de aquí → lo que entiendo →
 * el mundo»: una familia de Guatemala busca primero sus canales, luego los de
 * los vecinos y los que hablan su idioma, y solo después lo demás. Ordenar por
 * tema a secas ponía «4× Sky Sports» delante de TUDN y enterraba 540 canales
 * en español dentro de «Internacional».
 *
 * El país sale de la lista, no del nombre:
 * - `tvg-country` cuando lo trae;
 * - si no, el sufijo del `tvg-id` estilo iptv-org (`Canal11TuTV.sv@SD` → `sv`),
 *   que cubre el 88 % de la lista por defecto;
 * - y solo sin ninguno de los dos, las señales inequívocas de Guatemala en el
 *   nombre. Nada más por nombre: «Canal 3» existe en Formosa, en Biar y en
 *   Guatemala, y «Canal 11 TuTV» —que la regla vieja daba por chapín— es de
 *   El Salvador.
 */

import type { Channel } from "./types";
import { normalizeText } from "./text";

/** Las secciones geográficas de Canales, en el orden en que se recorren. */
export const REGIONES = [
  "guatemala",
  "centroamerica",
  "mexico",
  "caribe",
  "sudamerica",
  "espana",
  "eeuu",
  "mundo",
  "sin-pais",
] as const;

export type Region = (typeof REGIONES)[number];

/** Se abren con sus primeros canales: lo de aquí y lo que se entiende. */
export const REGIONES_ABIERTAS: readonly Region[] = [
  "guatemala",
  "centroamerica",
  "mexico",
  "caribe",
  "sudamerica",
  "espana",
];

/**
 * Plegadas en una sola fila con su número. No se esconde nada —cada una está a
 * un OK—, pero 759 canales de EE. UU. abiertos empujarían todo lo demás.
 */
export const REGIONES_PLEGADAS: readonly Region[] = ["eeuu", "mundo", "sin-pais"];

export const NOMBRE_DE_REGION: Record<Region, string> = {
  guatemala: "Guatemala",
  centroamerica: "Centroamérica",
  mexico: "México",
  caribe: "Caribe",
  sudamerica: "Sudamérica",
  espana: "España",
  eeuu: "Estados Unidos",
  mundo: "Resto del mundo",
  "sin-pais": "Sin país",
};

/** País (código ISO de dos letras, en minúsculas) → región. */
const REGION_DE_PAIS: Record<string, Region> = {
  gt: "guatemala",
  sv: "centroamerica",
  hn: "centroamerica",
  ni: "centroamerica",
  cr: "centroamerica",
  pa: "centroamerica",
  bz: "centroamerica",
  mx: "mexico",
  // El Caribe que habla español. Jamaica o Haití van al resto del mundo: la
  // sección existe por el idioma, no por el mapa.
  do: "caribe",
  pr: "caribe",
  cu: "caribe",
  co: "sudamerica",
  ve: "sudamerica",
  ec: "sudamerica",
  pe: "sudamerica",
  bo: "sudamerica",
  cl: "sudamerica",
  ar: "sudamerica",
  uy: "sudamerica",
  py: "sudamerica",
  es: "espana",
  us: "eeuu",
};

export function regionDePais(pais: string): Region {
  if (!pais) return "sin-pais";
  return REGION_DE_PAIS[pais] ?? "mundo";
}

export function esRegion(valor: string): valor is Region {
  return (REGIONES as readonly string[]).includes(valor);
}

/**
 * Nombres en español de los países que más salen. Escritos a mano y no solo
 * con `Intl.DisplayNames` porque esa API llegó en Chromium 81 y algunas teles
 * la traen sin datos de idioma: devuelve el código tal cual. Para el resto se
 * intenta con ella y, si no, se enseña el código en mayúsculas.
 */
const NOMBRE_DE_PAIS: Record<string, string> = {
  gt: "Guatemala",
  sv: "El Salvador",
  hn: "Honduras",
  ni: "Nicaragua",
  cr: "Costa Rica",
  pa: "Panamá",
  bz: "Belice",
  mx: "México",
  do: "República Dominicana",
  pr: "Puerto Rico",
  cu: "Cuba",
  co: "Colombia",
  ve: "Venezuela",
  ec: "Ecuador",
  pe: "Perú",
  bo: "Bolivia",
  cl: "Chile",
  ar: "Argentina",
  uy: "Uruguay",
  py: "Paraguay",
  es: "España",
  us: "Estados Unidos",
  ca: "Canadá",
  br: "Brasil",
  uk: "Reino Unido",
  gb: "Reino Unido",
  fr: "Francia",
  de: "Alemania",
  it: "Italia",
  pt: "Portugal",
  nl: "Países Bajos",
  be: "Bélgica",
  ch: "Suiza",
  at: "Austria",
  ru: "Rusia",
  ua: "Ucrania",
  pl: "Polonia",
  ro: "Rumanía",
  gr: "Grecia",
  tr: "Turquía",
  cn: "China",
  hk: "Hong Kong",
  tw: "Taiwán",
  jp: "Japón",
  kr: "Corea del Sur",
  in: "India",
  pk: "Pakistán",
  id: "Indonesia",
  ph: "Filipinas",
  vn: "Vietnam",
  th: "Tailandia",
  my: "Malasia",
  ae: "Emiratos Árabes Unidos",
  sa: "Arabia Saudí",
  eg: "Egipto",
  ma: "Marruecos",
  dz: "Argelia",
  ir: "Irán",
  iq: "Irak",
  il: "Israel",
  ng: "Nigeria",
  za: "Sudáfrica",
  au: "Australia",
  nz: "Nueva Zelanda",
  al: "Albania",
  rs: "Serbia",
  hr: "Croacia",
  ba: "Bosnia y Herzegovina",
  bg: "Bulgaria",
  hu: "Hungría",
  cz: "Chequia",
  sk: "Eslovaquia",
  se: "Suecia",
  no: "Noruega",
  dk: "Dinamarca",
  fi: "Finlandia",
  ie: "Irlanda",
  jm: "Jamaica",
  ht: "Haití",
  tt: "Trinidad y Tobago",
};

let nombresIntl: Intl.DisplayNames | null | undefined;

export function nombreDePais(pais: string): string {
  if (!pais) return "";
  const propio = NOMBRE_DE_PAIS[pais];
  if (propio) return propio;
  if (nombresIntl === undefined) {
    try {
      nombresIntl =
        typeof Intl !== "undefined" && "DisplayNames" in Intl
          ? new Intl.DisplayNames(["es"], { type: "region", fallback: "none" })
          : null;
    } catch {
      nombresIntl = null;
    }
  }
  try {
    const nombre = nombresIntl?.of(pais.toUpperCase());
    // «ZZ» y compañía existen en la tabla de Intl como «Región desconocida»:
    // eso no es un nombre que enseñar junto a un canal.
    if (nombre && nombre.toLowerCase() !== pais && !/desconocid/i.test(nombre)) return nombre;
  } catch {
    // Código que Intl no reconoce (los hay inventados en las listas): abajo.
  }
  return pais.toUpperCase();
}

/** Nombres de país completos que algunas listas escriben en `tvg-country`. */
const PAIS_POR_NOMBRE: Record<string, string> = Object.fromEntries(
  Object.entries(NOMBRE_DE_PAIS).map(([codigo, nombre]) => [normalizeText(nombre), codigo]),
);
Object.assign(PAIS_POR_NOMBRE, {
  mexico: "mx",
  "united states": "us",
  usa: "us",
  spain: "es",
  "dominican republic": "do",
  "el salvador": "sv",
  panama: "pa",
  peru: "pe",
});

/**
 * `tvg-country` como venga: «GT», «gt», «GT;US», «Guatemala»… Con varios, el
 * primero, que en iptv-org es el país de origen.
 */
function paisDeAtributo(valor: string): string {
  const primero = normalizeText(valor.split(/[;,|]/)[0] ?? "").trim();
  if (!primero) return "";
  if (/^[a-z]{2}$/.test(primero)) return primero;
  return PAIS_POR_NOMBRE[primero] ?? "";
}

/** `Canal3.gt@SD` → `gt`; `00sReplay.us@SD` → `us`. */
export function paisDeTvgId(tvgId: string): string {
  const match = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
  return match ? match[1].toLowerCase() : "";
}

/**
 * Señales de Guatemala que no se confunden con nada, para las entradas sin
 * país. Las mismas de `categories.ts` menos «Canal 11 TuTV», que es de El
 * Salvador: lo dice su propio `tvg-id`.
 */
const SENALES_DE_GUATEMALA = /\b(guatemal\w*|chapin\w*|guatevision|tn ?23|totovision)\b/;
const NOMBRES_DE_GUATEMALA = /^(canal ?[3789]|canal ?1[13]|canal ?2[07])$/;

export function paisDeCanal({
  nombre,
  tvgCountry = "",
  tvgId = "",
}: {
  nombre: string;
  tvgCountry?: string;
  tvgId?: string;
}): string {
  const declarado = paisDeAtributo(tvgCountry) || paisDeTvgId(tvgId);
  if (declarado) return declarado;
  const normalizado = normalizeText(nombre).trim();
  if (SENALES_DE_GUATEMALA.test(normalizado) || NOMBRES_DE_GUATEMALA.test(normalizado)) return "gt";
  return "";
}

/**
 * El país de cada canal YA desempaquetado, sin añadir un campo a `Channel`.
 *
 * `Channel` no puede crecer: cada campo viaja con cada canal, y la decisión
 * está cerrada. El país viaja una vez por combinación en la tabla de pares del
 * paquete (ver `canales-empaquetados.ts`), y al desempaquetar se apunta aquí.
 *
 * Un `WeakMap` por objeto y no un mapa por `id`: así dos listas a la vez —el
 * recorte del HTML y la completa que llega después— no se pisan, y lo que deje
 * de usarse se recoge solo. La contrapartida es que una COPIA del canal
 * (`{ ...canal }`) pierde el país; nadie copia canales hoy, y si alguien lo
 * hace la fila dirá «sin país», que no rompe nada.
 */
const PAIS_DEL_CANAL = new WeakMap<Channel, string>();

export function anotarPais(canal: Channel, pais: string) {
  if (pais) PAIS_DEL_CANAL.set(canal, pais);
}

export function paisDe(canal: Channel): string {
  return PAIS_DEL_CANAL.get(canal) ?? "";
}

export function regionDe(canal: Channel): Region {
  return regionDePais(paisDe(canal));
}
