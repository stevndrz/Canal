/**
 * Buscar canales por nombre, número, país y tema, por orden de relevancia.
 *
 * La búsqueda de antes solo miraba el nombre y el principio del número: «guate»
 * daba UN canal (Guatevision) de los 27 de Guatemala, «honduras» dos de 38 y
 * «noticias» seis de 628. Y salían en el orden de la lista, así que «7» traía
 * 308 canales con Canal 7 perdido entre ellos. Aquí cada palabra puede casar
 * con el nombre, el número, el país (o un apodo: «chapín», «catracho») o el
 * tema (o un sinónimo: «fútbol», «caricaturas»), y lo que casa por el nombre
 * va delante de lo que casa por el país.
 *
 * El texto de cada canal se normaliza UNA vez por lista (`indexarBusqueda`, con
 * memoria por lista): antes eran 4.816 llamadas a `normalize()` por tecla, que
 * en una tele Tizen se notan en cada letra del teclado en pantalla.
 *
 * Sin React ni DOM, con prueba: `buscar-canales.test.ts`.
 */

import type { Channel } from "./types";
import { normalizeText } from "./text";
import { TEMAS, type Tema } from "./temas";
import { NOMBRE_DE_REGION, REGIONES, nombreDePais, paisDe, regionDePais, type Region } from "./origenes";

/** Fuera de la función por lo mismo que en `text.ts`: en las teles viejas cuesta crearla. */
const NO_LETRA_NI_NUMERO = /[^\p{L}\p{N}]+/gu;

/** Minúsculas, sin tildes y con la puntuación hecha espacios: «TN23 (HD)» → «tn23 hd». */
function plano(texto: string): string {
  return normalizeText(texto).replace(NO_LETRA_NI_NUMERO, " ").trim();
}

/* ── Sinónimos ──────────────────────────────────────────────────────────── */

/**
 * Cómo se busca un tema sin saber cómo se llama aquí. Las claves van en plano
 * (sin tildes) y casan por el principio: «notici» ya encuentra Noticias.
 */
const SINONIMOS_DE_TEMA: Record<string, Tema> = {
  generalista: "Generalista",
  general: "Generalista",
  noticias: "Noticias",
  noticiero: "Noticias",
  noticieros: "Noticias",
  news: "Noticias",
  informativo: "Noticias",
  informativos: "Noticias",
  deportes: "Deportes",
  deportivo: "Deportes",
  futbol: "Deportes",
  soccer: "Deportes",
  sports: "Deportes",
  beisbol: "Deportes",
  boxeo: "Deportes",
  infantil: "Infantil",
  ninos: "Infantil",
  kids: "Infantil",
  caricaturas: "Infantil",
  dibujos: "Infantil",
  animados: "Infantil",
  cartoon: "Infantil",
  peliculas: "Películas y series",
  cine: "Películas y series",
  series: "Películas y series",
  movies: "Películas y series",
  novelas: "Películas y series",
  telenovelas: "Películas y series",
  variedades: "Variedades",
  entretenimiento: "Variedades",
  cocina: "Variedades",
  comedia: "Variedades",
  documentales: "Documentales",
  cultura: "Documentales",
  ciencia: "Documentales",
  educacion: "Documentales",
  historia: "Documentales",
  naturaleza: "Documentales",
  musica: "Música",
  music: "Música",
  religion: "Religión",
  cristiano: "Religión",
  cristianos: "Religión",
  catolico: "Religión",
  catolica: "Religión",
  evangelico: "Religión",
  iglesia: "Religión",
  biblia: "Religión",
  institucional: "Institucional",
  gobierno: "Institucional",
  congreso: "Institucional",
  legislativo: "Institucional",
  compras: "Compras",
  ventas: "Compras",
  shopping: "Compras",
};

/** Cómo llama la gente a los de cada país, además de su nombre. */
const APODOS_DE_PAIS: Record<string, string> = {
  guate: "gt",
  chapin: "gt",
  chapines: "gt",
  chapina: "gt",
  catracho: "hn",
  catrachos: "hn",
  guanaco: "sv",
  guanacos: "sv",
  salvador: "sv",
  tico: "cr",
  ticos: "cr",
  nica: "ni",
  nicas: "ni",
  mexicano: "mx",
  mexicanos: "mx",
  usa: "us",
  eeuu: "us",
  gringo: "us",
  gringos: "us",
  dominicana: "do",
  dominicano: "do",
};

/** Las palabras de un apodo o un nombre más cortas que esto no casan por el principio. */
const MINIMO_PREFIJO = 3;

/** Palabras de relleno en los nombres de país, que no dicen de dónde es nada. */
const RELLENO = new Set(["del", "las", "los", "and", "the", "islas", "isla", "republica"]);

/* ── Índice ─────────────────────────────────────────────────────────────── */

interface Entrada {
  canal: Channel;
  /** El nombre entero, en plano. */
  nombre: string;
  palabras: string[];
  pais: string;
  region: Region;
  /** Posición en la lista, ya ordenada por región: el desempate. */
  orden: number;
}

export interface IndiceBusqueda {
  entradas: Entrada[];
  /** Palabra (en plano) del nombre de un país o región → países que cubre. */
  paisesPorPalabra: Map<string, Set<string>>;
}

const MEMORIA = new WeakMap<readonly Channel[], IndiceBusqueda>();

/**
 * El índice de una lista, calculado una sola vez por lista: la siguiente
 * llamada con el MISMO array lo devuelve de memoria. La lista llega como la
 * pinta el shell (los caídos al final) y aquí se agrupa por región, de lo
 * cercano a lo lejano, sin perder ese orden dentro de cada región.
 */
export function indexarBusqueda(canales: readonly Channel[]): IndiceBusqueda {
  const guardado = MEMORIA.get(canales);
  if (guardado) return guardado;

  const paisesPorPalabra = new Map<string, Set<string>>();
  const anotar = (texto: string, pais: string) => {
    for (const palabra of plano(texto).split(" ")) {
      // «del» de «Corea del Sur» no puede llevar a Corea a quien busca «del…».
      if (palabra.length < MINIMO_PREFIJO || RELLENO.has(palabra)) continue;
      const conjunto = paisesPorPalabra.get(palabra);
      if (conjunto) conjunto.add(pais);
      else paisesPorPalabra.set(palabra, new Set([pais]));
    }
  };
  for (const [apodo, pais] of Object.entries(APODOS_DE_PAIS)) anotar(apodo, pais);

  const crudas = canales.map((canal) => {
    const pais = paisDe(canal);
    const region = regionDePais(pais);
    if (pais) {
      anotar(nombreDePais(pais), pais);
      // «centroamerica» busca todos los países de la región.
      if (region !== "mundo" && region !== "sin-pais") anotar(NOMBRE_DE_REGION[region], pais);
    }
    const nombre = plano(canal.name);
    return { canal, nombre, palabras: nombre.split(" ").filter(Boolean), pais, region };
  });

  const entradas = crudas
    .map((cruda, posicion) => ({ cruda, posicion }))
    .sort(
      (a, b) =>
        REGIONES.indexOf(a.cruda.region) - REGIONES.indexOf(b.cruda.region) || a.posicion - b.posicion,
    )
    .map(({ cruda }, orden): Entrada => ({ ...cruda, orden }));

  const indice = { entradas, paisesPorPalabra };
  MEMORIA.set(canales, indice);
  return indice;
}

/* ── Relevancia ─────────────────────────────────────────────────────────── */

/**
 * Niveles, de más a menos relevante. Un canal toma el nivel de su palabra
 * PEOR casada: «noticias honduras» pide las dos cosas, y lo que manda es la
 * más floja de las dos.
 */
export const NIVEL = {
  /** El número exacto, o el nombre entero tal cual. */
  exacto: 0,
  /** El nombre empieza por todo lo escrito: «canal 7» → «Canal 7 Esquipulas». */
  empiezaIgual: 1,
  /** Una palabra del nombre es la buscada: «7» → «Canal 7». */
  palabra: 2,
  /** Una palabra del nombre empieza por la buscada: «guate» → «Guatevision». */
  principioDePalabra: 3,
  /** El nombre la contiene por dentro: «vision» → «Guatevision». */
  dentro: 4,
  /** El número empieza por lo marcado: «10» → 101, 102… */
  numero: 5,
  /** El país o la región: «honduras», «guate», «centroamerica». */
  pais: 6,
  /** El tema: «noticias», «futbol». */
  tema: 7,
} as const;

const NINGUNO = Number.POSITIVE_INFINITY;

/** Los temas que casan con una palabra, por su nombre o por un sinónimo. */
function temasDe(palabra: string): Set<string> {
  const temas = new Set<string>();
  if (palabra.length < MINIMO_PREFIJO) return temas;
  for (const tema of TEMAS) {
    if (plano(tema).split(" ").some((trozo) => trozo.startsWith(palabra))) temas.add(tema);
  }
  for (const [sinonimo, tema] of Object.entries(SINONIMOS_DE_TEMA)) {
    if (sinonimo.startsWith(palabra)) temas.add(tema);
  }
  return temas;
}

/** Los países que casan con una palabra: su nombre, su región o un apodo. */
function paisesDe(indice: IndiceBusqueda, palabra: string): Set<string> {
  const paises = new Set<string>();
  if (palabra.length < MINIMO_PREFIJO) return paises;
  for (const [clave, conjunto] of indice.paisesPorPalabra) {
    if (clave.startsWith(palabra)) for (const pais of conjunto) paises.add(pais);
  }
  return paises;
}

interface Palabra {
  texto: string;
  esNumero: boolean;
  paises: Set<string>;
  temas: Set<string>;
}

function nivelDePalabra(entrada: Entrada, palabra: Palabra): number {
  const { texto } = palabra;
  if (palabra.esNumero && entrada.canal.number === texto) return NIVEL.exacto;
  let nivel: number = NINGUNO;
  for (const trozo of entrada.palabras) {
    if (trozo === texto) return NIVEL.palabra;
    if (trozo.startsWith(texto)) nivel = NIVEL.principioDePalabra;
  }
  if (nivel !== NINGUNO) return nivel;
  // Por dentro solo con tres letras o más: con una sola, casi todo la lleva.
  if (texto.length >= MINIMO_PREFIJO && entrada.nombre.includes(texto)) return NIVEL.dentro;
  if (palabra.esNumero && entrada.canal.number.startsWith(texto)) return NIVEL.numero;
  if (entrada.pais && palabra.paises.has(entrada.pais)) return NIVEL.pais;
  if (palabra.temas.has(entrada.canal.category)) return NIVEL.tema;
  return NINGUNO;
}

/** El nivel de un canal para lo escrito, o `Infinity` si no casa. */
function nivelDe(entrada: Entrada, consulta: string, palabras: Palabra[]): number {
  if (entrada.nombre === consulta) return NIVEL.exacto;
  if (palabras.length > 1 && entrada.nombre.startsWith(consulta)) return NIVEL.empiezaIgual;
  let peor = -1;
  for (const palabra of palabras) {
    const nivel = nivelDePalabra(entrada, palabra);
    if (nivel === NINGUNO) return NINGUNO;
    if (nivel > peor) peor = nivel;
  }
  return peor;
}

/**
 * Los canales que casan con `texto`, del más al menos relevante. Con el mismo
 * nivel, en el orden del índice: Guatemala primero, luego los vecinos.
 */
export function buscarCanales(canales: readonly Channel[], texto: string): Channel[] {
  const consulta = plano(texto);
  if (!consulta) return [];
  const indice = indexarBusqueda(canales);
  const palabras: Palabra[] = consulta.split(" ").map((trozo) => ({
    texto: trozo,
    esNumero: /^\d+$/.test(trozo),
    paises: paisesDe(indice, trozo),
    temas: temasDe(trozo),
  }));

  const encontrados: { entrada: Entrada; nivel: number }[] = [];
  for (const entrada of indice.entradas) {
    const nivel = nivelDe(entrada, consulta, palabras);
    if (nivel !== NINGUNO) encontrados.push({ entrada, nivel });
  }
  encontrados.sort((a, b) => a.nivel - b.nivel || a.entrada.orden - b.entrada.orden);
  return encontrados.map(({ entrada }) => entrada.canal);
}

/** El texto de «no hay nada», con una pista de lo que sí funciona. */
export function textoSinResultados(texto: string): string {
  return `No hay canales con «${texto.trim()}». Prueba con el país («Honduras») o el tema («noticias»).`;
}
