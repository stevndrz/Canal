/**
 * Cómo se reparte la lista de Canales en secciones, y en qué orden va cada una.
 *
 * Una lista plana de 4.816 canales en orden alfabético no se recorre con un
 * mando: hacían falta 28 ↓ para llegar a Deportes y la primera fila de
 * Deportes era «4× Sky Sports». Aquí se parte en lo que una familia de
 * Guatemala busca, en este orden: **lo mío → lo de aquí → lo que entiendo →
 * el mundo** (ver `origenes.ts` para las regiones y `temas.ts` para los
 * temas).
 *
 * Todo es aritmética sin DOM ni React, para poder probarlo. Lo usan tres
 * sitios que TIENEN que estar de acuerdo:
 * - `posicionesIniciales` en el servidor, para decidir qué canales viajan en el
 *   HTML (las cabezas de cada sección y de cada riel de Inicio);
 * - la pantalla de Canales, que pinta esas secciones;
 * - Inicio, que pinta los rieles.
 * Si dos de ellos ordenaran distinto, la primera pantalla abriría con huecos
 * hasta que llegara la lista completa.
 */

import type { Channel } from "./types";
import { priorityRank } from "./categories";
import { normalizeChannelName, normalizeText } from "./text";
import { TEMAS_DE_MAS, ordenDeTema, type Tema } from "./temas";
import {
  NOMBRE_DE_REGION,
  REGIONES,
  REGIONES_ABIERTAS,
  REGIONES_PLEGADAS,
  nombreDePais,
  paisDe,
  regionDePais,
  type Region,
} from "./origenes";

/** Lo mínimo para ordenar: sirve igual para un `Channel` que para una tupla del paquete. */
export interface Ficha {
  nombre: string;
  tema: string;
  pais: string;
}

/** La ficha de un canal ya desempaquetado: el tema viaja en `category`. */
export function fichaDe(canal: Channel): Ficha {
  return { nombre: canal.name, tema: canal.category, pais: paisDe(canal) };
}

// Un colador reutilizado: `localeCompare` reconstruye el suyo en cada
// comparación, y aquí se comparan miles de nombres por lista.
const colador = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

/** Sin rango curado: detrás de todos los que sí lo tienen. */
const SIN_RANGO = Number.MAX_SAFE_INTEGER;

/**
 * Lo que la casa y la lista de importantes ponen delante, en este orden:
 * 1. Los canales de la casa (`canalesDeCasa`), en su orden.
 * 2. Los importantes de su tema (`CHANNEL_PRIORITY`: ESPN, TUDN, CNN en
 *    Español…) y, si es de Guatemala, los de `FEATURED_CHANNEL_PATTERNS`.
 *
 * `casa` llega ya normalizada con `normalizeChannelName`, una vez por lista y
 * no una por canal.
 */
export function rangoCurado(ficha: Ficha, casa: readonly string[]): number {
  const enCasa = casa.indexOf(normalizeChannelName(ficha.nombre));
  if (enCasa !== -1) return enCasa;
  const delTema = priorityRank(ficha.nombre, ficha.tema);
  const chapin = ficha.pais === "gt" ? priorityRank(ficha.nombre, "Guatemala") : SIN_RANGO;
  const mejor = Math.min(delTema, chapin);
  return mejor === SIN_RANGO ? SIN_RANGO : casa.length + mejor;
}

export function normalizarCasa(nombres: readonly string[]): string[] {
  return nombres.map((nombre) => normalizeChannelName(nombre));
}

/**
 * Orden DENTRO de una sección (§2.4 del informe): lo curado primero, luego el
 * tema en su orden fijo (generalistas, noticias, deportes…) y luego el nombre.
 * Los caídos no se miran aquí: dependen de cada aparato y se apartan al final
 * en el cliente (`apartarCaidos`), sin volver a ordenar.
 *
 * El rango se calcula una vez por elemento y no dentro del comparador: son
 * expresiones regulares, y con miles de canales el comparador se llama decenas
 * de miles de veces.
 */
export function ordenarFichas<T>(
  items: readonly T[],
  ficha: (item: T) => Ficha,
  casa: readonly string[],
  { regionPrimero = false }: { regionPrimero?: boolean } = {},
): T[] {
  const claves = items.map((item) => {
    const f = ficha(item);
    return {
      item,
      rango: rangoCurado(f, casa),
      region: regionPrimero ? REGIONES.indexOf(regionDePais(f.pais)) : 0,
      tema: ordenDeTema(f.tema),
      nombre: f.nombre,
    };
  });
  claves.sort(
    (a, b) =>
      a.rango - b.rango ||
      a.region - b.region ||
      a.tema - b.tema ||
      colador.compare(a.nombre, b.nombre),
  );
  return claves.map(({ item }) => item);
}

/** Los caídos al final, conservando el orden de cada mitad. */
export function apartarCaidos(canales: readonly Channel[], caidos: ReadonlySet<number>): Channel[] {
  if (caidos.size === 0) return canales as Channel[];
  const sanos: Channel[] = [];
  const apartados: Channel[] = [];
  for (const canal of canales) (caidos.has(canal.id) ? apartados : sanos).push(canal);
  return apartados.length === 0 ? (canales as Channel[]) : [...sanos, ...apartados];
}

/* ── Recuentos ──────────────────────────────────────────────────────────── */

/**
 * La clave con la que el paquete cuenta canales por región y tema EN LA LISTA
 * COMPLETA (ver `recuentosDe`). Hace falta porque la primera pantalla solo
 * tiene unos pocos canales y aun así tiene que decir «Ver los 527 de
 * Sudamérica», no «Ver los 12».
 *
 * Empieza por «§» para no chocar nunca con el nombre de una categoría, que
 * comparte el mismo mapa.
 */
export function claveDeRecuento(region: Region | null, tema: string | null): string {
  return `§${region ?? "*"}|${tema ?? "*"}`;
}

/* ── Filtro de la cabecera ──────────────────────────────────────────────── */

/** «★ Mis canales», «Todo», un tema, o «Más» (los temas de la cola). */
export type Filtro = "mios" | "todo" | "mas" | Tema;

export function pasaFiltro(tema: string, filtro: Filtro): boolean {
  if (filtro === "todo" || filtro === "mios") return true;
  if (filtro === "mas") return (TEMAS_DE_MAS as readonly string[]).includes(tema);
  return tema === filtro;
}

/** Cuántos de la lista completa caen en una región con un filtro, según el paquete. */
function recuentoCompleto(
  recuentos: ReadonlyMap<string, number> | undefined,
  region: Region | null,
  filtro: Filtro,
): number {
  if (!recuentos) return 0;
  if (filtro === "todo" || filtro === "mios") return recuentos.get(claveDeRecuento(region, null)) ?? 0;
  const temas = filtro === "mas" ? TEMAS_DE_MAS : [filtro];
  return temas.reduce((suma, tema) => suma + (recuentos.get(claveDeRecuento(region, tema)) ?? 0), 0);
}

/* ── Índice ─────────────────────────────────────────────────────────────── */

/**
 * Lo caro, hecho una vez por lista: cada canal en su región y en su orden, y
 * el texto en el que se busca ya normalizado. Buscar recorría 4.816 canales
 * llamando a `normalize()` en cada pulsación; en una Tizen eso se nota.
 */
export interface IndiceSecciones {
  porRegion: Map<Region, Channel[]>;
  /** Todas, en el orden de las regiones: lo que se recorre al buscar. */
  enOrden: Channel[];
  textoDe: Map<Channel, string>;
}

export function indexarCanales(canales: readonly Channel[], casa: readonly string[]): IndiceSecciones {
  const porRegion = new Map<Region, Channel[]>(REGIONES.map((region) => [region, []]));
  const textoDe = new Map<Channel, string>();
  /**
   * País, región y tema son unas pocas decenas de textos repetidos 4.816
   * veces, y casi todos llevan tilde («México», «Religión»), lo que manda la
   * cadena entera por el camino lento de `normalizeText`. Se normalizan una
   * vez cada uno y el nombre —casi siempre ASCII— aparte. Mismo resultado:
   * la normalización va letra a letra y el espacio separa los trozos.
   */
  const repetidos = new Map<string, string>();
  const normalizarRepetido = (texto: string) => {
    let hecho = repetidos.get(texto);
    if (hecho === undefined) {
      hecho = normalizeText(texto);
      repetidos.set(texto, hecho);
    }
    return hecho;
  };
  for (const canal of canales) {
    const pais = paisDe(canal);
    const region = regionDePais(pais);
    porRegion.get(region)!.push(canal);
    textoDe.set(
      canal,
      `${normalizeText(canal.name)} ${normalizarRepetido(
        `${nombreDePais(pais)} ${NOMBRE_DE_REGION[region]} ${canal.category}`,
      )}`,
    );
  }
  for (const region of REGIONES) {
    porRegion.set(region, ordenarFichas(porRegion.get(region)!, fichaDe, casa));
  }
  return { porRegion, enOrden: REGIONES.flatMap((region) => porRegion.get(region)!), textoDe };
}

/**
 * ¿Casa con lo escrito? Todas las palabras tienen que aparecer en el nombre, el
 * país, la región o el tema («noticias honduras» encuentra HCH), y un número
 * casa con el principio del número de canal.
 */
export function casaConBusqueda(indice: IndiceSecciones, canal: Channel, busqueda: string): boolean {
  const palabras = normalizeText(busqueda).trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  if (palabras.length === 1 && /^\d+$/.test(palabras[0]) && canal.number.startsWith(palabras[0])) {
    return true;
  }
  const texto = indice.textoDe.get(canal) ?? normalizeText(canal.name);
  return palabras.every((palabra) => texto.includes(palabra));
}

/* ── Filas de la lista ──────────────────────────────────────────────────── */

/**
 * Lo que pinta la lista, ya aplanado. Cabeceras, filas de canal y botones van
 * en el MISMO array y miden lo mismo: así la ventana virtual de
 * `live-tv-view.tsx` sigue siendo una división (fila n → n × alto) y no hace
 * falta un índice de alturas.
 */
export type Fila =
  | { tipo: "cabecera"; clave: string; titulo: string; detalle: string }
  | { tipo: "subcabecera"; clave: string; titulo: string; detalle: string }
  /**
   * `sinPais`: la sección ya dice el país (Guatemala, México, una subcabecera
   * de país…) y repetirlo en cada fila es ruido que se come el ancho.
   */
  | { tipo: "canal"; clave: string; canal: Channel; sinPais?: boolean }
  | { tipo: "aviso"; clave: string; texto: string }
  | { tipo: "ver-todos"; clave: string; region: Region; total: number }
  | { tipo: "plegada"; clave: string; region: Region; total: number }
  | { tipo: "volver"; clave: string; region: Region };

export interface OpcionesFilas {
  indice: IndiceSecciones;
  filtro: Filtro;
  /** La sección abierta entera («Ver los N»), o `null` para el resumen. */
  abierta: Region | null;
  busqueda: string;
  /** Los canales de la casa (`canalesDeCasa`), en su orden. */
  deLaCasa: readonly Channel[];
  /** Los marcados con la estrella en este aparato. */
  favoritos: readonly Channel[];
  recientes: readonly Channel[];
  caidos: ReadonlySet<number>;
  /** Cuántos canales enseña cada sección abierta antes de «Ver los N». */
  porSeccion: number;
  /** Los de la lista completa, para los totales. Ver `claveDeRecuento`. */
  recuentos?: ReadonlyMap<string, number>;
}

/** Cuántos de «Vistos hace poco»: los de una semana normal, no un historial. */
export const MAX_RECIENTES = 12;

/** «1.240», como se escribe aquí. */
export function cifra(numero: number): string {
  return numero.toLocaleString("es-GT");
}

function detalleDeTotal(total: number, filtro: Filtro): string {
  const canales = total === 1 ? "1 canal" : `${cifra(total)} canales`;
  if (filtro === "todo" || filtro === "mios") return canales;
  const de = filtro === "mas" ? "otros temas" : filtro;
  return `${cifra(total)} de ${de}`;
}

/** Las regiones de varios países se parten por país al abrirlas enteras. */
const POR_PAIS: ReadonlySet<Region> = new Set<Region>(["centroamerica", "caribe", "sudamerica", "mundo"]);

/** Las que son un solo país: su cabecera ya lo dice. */
const DE_UN_PAIS: ReadonlySet<Region> = new Set<Region>(["guatemala", "mexico", "espana", "eeuu"]);

export function filasDeCanales(opciones: OpcionesFilas): Fila[] {
  const { indice, filtro, abierta, busqueda, caidos } = opciones;
  const pasa = (canal: Channel) => pasaFiltro(canal.category, filtro);

  if (busqueda.trim()) return filasDeBusqueda(opciones);
  if (abierta) return filasDeSeccionAbierta(opciones, abierta);

  const filas: Fila[] = [];

  // 1. Mis canales: la casa y los favoritos, siempre arriba.
  const misCanales = unirMisCanales(opciones.deLaCasa, opciones.favoritos);
  const mios = misCanales.filter(pasa);
  const idsMios = new Set(misCanales.map((canal) => canal.id));
  if (mios.length > 0 || filtro === "todo" || filtro === "mios") {
    filas.push({
      tipo: "cabecera",
      clave: "cab:mios",
      titulo: "Mis canales",
      detalle: mios.length > 0 ? detalleDeTotal(mios.length, filtro) : "",
    });
    for (const canal of mios) filas.push({ tipo: "canal", clave: `mios:${canal.id}`, canal });
    // Sin ningún favorito todavía, se explica cómo se consigue uno: la estrella
    // de la fila no se descubre sola.
    const hayFavoritos = misCanales.length > opciones.deLaCasa.length;
    if (!hayFavoritos && (filtro === "mios" || filtro === "todo")) {
      filas.push({ tipo: "aviso", clave: "aviso:mios", texto: "Marca la estrella de un canal y aparecerá aquí y en Inicio" });
    }
  }

  // 2. Vistos hace poco, sin repetir los de arriba.
  const recientes = opciones.recientes
    .filter((canal) => !idsMios.has(canal.id) && pasa(canal))
    .slice(0, MAX_RECIENTES);
  if (recientes.length > 0) {
    filas.push({
      tipo: "cabecera",
      clave: "cab:recientes",
      titulo: "Vistos hace poco",
      detalle: "",
    });
    for (const canal of recientes) filas.push({ tipo: "canal", clave: `recientes:${canal.id}`, canal });
  }

  if (filtro === "mios") return filas;

  // 3. Lo de aquí y lo que se entiende: abiertas, con sus primeros canales.
  for (const region of REGIONES_ABIERTAS) {
    const todos = apartarCaidos(indice.porRegion.get(region)!.filter(pasa), caidos);
    const total = Math.max(todos.length, recuentoCompleto(opciones.recuentos, region, filtro));
    if (total === 0) continue;
    // Los de «Mis canales» ya están a la vista arriba: repetirlos aquí gastaba
    // tres de las ocho filas de Guatemala en Canal 3, Canal 7 y Guatevisión.
    const cabeza = todos.filter((canal) => !idsMios.has(canal.id)).slice(0, opciones.porSeccion);
    filas.push({
      tipo: "cabecera",
      clave: `cab:${region}`,
      titulo: NOMBRE_DE_REGION[region],
      detalle: detalleDeTotal(total, filtro),
    });
    const sinPais = DE_UN_PAIS.has(region);
    for (const canal of cabeza) {
      filas.push({ tipo: "canal", clave: `${region}:${canal.id}`, canal, sinPais });
    }
    if (cabeza.length < total) {
      filas.push({ tipo: "ver-todos", clave: `ver:${region}`, region, total });
    }
  }

  // 4. El resto, plegado y con su número: nada escondido, nada en medio.
  const plegadas = REGIONES_PLEGADAS.map((region) => ({
    region,
    total: Math.max(
      indice.porRegion.get(region)!.filter(pasa).length,
      recuentoCompleto(opciones.recuentos, region, filtro),
    ),
  })).filter(({ total }) => total > 0);
  if (plegadas.length > 0) {
    filas.push({ tipo: "cabecera", clave: "cab:lejos", titulo: "Más lejos", detalle: "" });
    for (const { region, total } of plegadas) {
      filas.push({ tipo: "plegada", clave: `plegada:${region}`, region, total });
    }
  }

  if (filas.every((fila) => fila.tipo !== "canal" && fila.tipo !== "plegada")) {
    return [{ tipo: "aviso", clave: "aviso:vacio", texto: "No hay canales de este tema." }];
  }
  return filas;
}

/**
 * Une la casa y los favoritos en «Mis canales», sin repetir. La casa delante,
 * en su orden configurado; los favoritos detrás, en el orden de la lista y no
 * en el que se marcaron, para que un mismo aparato los vea siempre igual.
 */
export function unirMisCanales(deLaCasa: readonly Channel[], favoritos: readonly Channel[]): Channel[] {
  const ids = new Set(deLaCasa.map((canal) => canal.id));
  return [...deLaCasa, ...favoritos.filter((canal) => !ids.has(canal.id))];
}

function filasDeSeccionAbierta(opciones: OpcionesFilas, region: Region): Fila[] {
  const { indice, filtro, caidos } = opciones;
  const todos = apartarCaidos(
    indice.porRegion.get(region)!.filter((canal) => pasaFiltro(canal.category, filtro)),
    caidos,
  );
  const total = Math.max(todos.length, recuentoCompleto(opciones.recuentos, region, filtro));
  const filas: Fila[] = [
    { tipo: "volver", clave: `volver:${region}`, region },
    {
      tipo: "cabecera",
      clave: `cab:${region}`,
      titulo: NOMBRE_DE_REGION[region],
      detalle: detalleDeTotal(total, filtro),
    },
  ];

  if (todos.length === 0) {
    filas.push({ tipo: "aviso", clave: "aviso:vacio", texto: "No hay canales de este tema aquí." });
    return filas;
  }

  if (!POR_PAIS.has(region)) {
    const sinPais = DE_UN_PAIS.has(region);
    for (const canal of todos) filas.push({ tipo: "canal", clave: `${region}:${canal.id}`, canal, sinPais });
    return filas;
  }

  // Varios países: una subcabecera por país, por orden alfabético —quien busca
  // «los de Honduras» los encuentra juntos y sabe dónde mirar—. Dentro de cada
  // país se conserva el orden de la sección.
  const porPais = new Map<string, Channel[]>();
  for (const canal of todos) {
    const pais = paisDe(canal);
    const lista = porPais.get(pais);
    if (lista) lista.push(canal);
    else porPais.set(pais, [canal]);
  }
  const paises = [...porPais.keys()].sort((a, b) => colador.compare(nombreDePais(a), nombreDePais(b)));
  for (const pais of paises) {
    const canales = porPais.get(pais)!;
    filas.push({
      tipo: "subcabecera",
      clave: `pais:${pais}`,
      titulo: nombreDePais(pais) || "Sin país",
      detalle: canales.length === 1 ? "1 canal" : `${cifra(canales.length)} canales`,
    });
    for (const canal of canales) {
      filas.push({ tipo: "canal", clave: `${region}:${canal.id}`, canal, sinPais: true });
    }
  }
  return filas;
}

function filasDeBusqueda(opciones: OpcionesFilas): Fila[] {
  const { indice, filtro, busqueda, caidos } = opciones;
  const encontrados = apartarCaidos(
    indice.enOrden.filter(
      (canal) => pasaFiltro(canal.category, filtro) && casaConBusqueda(indice, canal, busqueda),
    ),
    caidos,
  );
  if (encontrados.length === 0) {
    return [
      {
        tipo: "aviso",
        clave: "aviso:busqueda",
        texto: `No hay canales con «${busqueda.trim()}». Prueba con el país («Honduras») o el tema («noticias»).`,
      },
    ];
  }
  return [
    {
      tipo: "cabecera",
      clave: "cab:busqueda",
      titulo: "Resultados",
      detalle: detalleDeTotal(encontrados.length, "todo"),
    },
    ...encontrados.map((canal): Fila => ({ tipo: "canal", clave: `busqueda:${canal.id}`, canal })),
  ];
}

/* ── Rieles de Inicio ───────────────────────────────────────────────────── */

export interface RielDeInicio {
  clave: string;
  titulo: string;
  region?: Region;
  tema?: Tema;
}

/**
 * Los rieles de canales de Inicio: lo de aquí y lo que más se busca por tema.
 * Seis, como antes (`QUE_SE_PINTA.grupos`): cada riel son veinte destinos más
 * para el mando, y cada destino se mide en cada pulsación de flecha.
 */
export const RIELES_DE_INICIO: readonly RielDeInicio[] = [
  { clave: "guatemala", titulo: "Guatemala", region: "guatemala" },
  { clave: "centroamerica", titulo: "Centroamérica", region: "centroamerica" },
  { clave: "mexico", titulo: "México", region: "mexico" },
  { clave: "deportes", titulo: "Deportes", tema: "Deportes" },
  { clave: "noticias", titulo: "Noticias", tema: "Noticias" },
  { clave: "infantil", titulo: "Infantil", tema: "Infantil" },
];

/**
 * Los canales de cada riel, en orden, y cuántos tiene el riel en la lista que
 * se pasa. Genérico para que el servidor lo corra sobre las tuplas del paquete
 * y el cliente sobre `Channel`, con el mismo resultado.
 *
 * - El riel de Guatemala no repite los de la casa: van justo encima, en
 *   tarjetas grandes.
 * - Los de tema van por región (lo de aquí primero) después de lo curado: el
 *   riel de Deportes abre con ESPN y TUDN, no con «30A Golf Kingdom».
 */
export function rielesDeInicio<T>(
  items: readonly T[],
  ficha: (item: T) => Ficha,
  casa: readonly string[],
  { porRiel, rieles = RIELES_DE_INICIO }: { porRiel: number; rieles?: readonly RielDeInicio[] },
): { riel: RielDeInicio; items: T[]; total: number }[] {
  return rieles.map((riel) => {
    const delRiel = items.filter((item) => {
      const f = ficha(item);
      if (riel.region && regionDePais(f.pais) !== riel.region) return false;
      if (riel.tema && f.tema !== riel.tema) return false;
      return true;
    });
    const sinCasa =
      riel.region === "guatemala"
        ? delRiel.filter((item) => !casa.includes(normalizeChannelName(ficha(item).nombre)))
        : delRiel;
    const ordenados = ordenarFichas(sinCasa, ficha, casa, { regionPrimero: Boolean(riel.tema) });
    return { riel, items: ordenados.slice(0, porRiel), total: delRiel.length };
  });
}
