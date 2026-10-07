import { CATEGORY_ORDER } from "@/lib/categories";
import type { Channel } from "@/lib/types";
import { esTema, temaPorNombre, type Tema } from "@/lib/temas";
import { REGIONES_ABIERTAS, anotarPais, regionDePais } from "@/lib/origenes";
import {
  claveDeRecuento,
  normalizarCasa,
  ordenarFichas,
  rielesDeInicio,
  type Ficha,
} from "@/lib/secciones-canales";
import { publicConfig } from "@/lib/config";

/**
 * Cómo viajan los canales del servidor al navegador.
 *
 * La lista se serializa dentro del HTML de la portada: medido sobre el sitio
 * en vivo, **1,88 MB para 7.822 canales**, y la mitad no era información:
 *
 * | Campo                  | Peso    | Qué era                                |
 * |------------------------|---------|----------------------------------------|
 * | claves JSON repetidas  | ~850 KB | `\\"streamUrl\\":\\"` ×7.822, escapado dos veces |
 * | `streamUrl`            | 492 KB  | información de verdad                  |
 * | `logoUrl`              | 328 KB  | información de verdad                  |
 * | `name`                 | 111 KB  | información de verdad                  |
 * | `category`             |  93 KB  | **12 cadenas distintas, repetidas 7.822 veces** |
 * | `number`               |  30 KB  | **el cliente lo sobrescribe entero nada más llegar** |
 * | `id`                   |  30 KB  | **es `index + 1`: se deduce de la posición** |
 *
 * Así que el transporte deja de ser un objeto por canal y pasa a ser una
 * tupla: sin nombres de clave, sin lo deducible y con la categoría como índice
 * a una tabla que viaja una vez.
 *
 * `Channel` no cambia — solo cambia **lo que cruza el cable**. Encima de esto
 * va el recorte grande: un paquete no tiene por qué traerlos todos. Ver
 * `recortarPaquete`.
 */

/** Los datos de guía, que solo existen si hay EPG configurado. */
export type GuiaEmpaquetada = Pick<
  Channel,
  "currentProgram" | "nextProgram" | "currentStart" | "currentEnd" | "nextStart"
>;

/**
 * Un canal, en el orden en que se empaqueta.
 *
 * El quinto hueco es polimorfo a propósito: sin guía es la URL de respaldo
 * (`string`) cuando la hay, y con guía es el objeto de guía. Con guía Y
 * respaldo, el respaldo va en el sexto. Así el canal normal sigue siendo
 * cuatro valores y el respaldo solo cuesta donde existe.
 *
 * El segundo hueco depende de la versión del paquete: en la 1 apunta a
 * `categorias`; en la 2, a `pares`. Ver `PaqueteCanales.v`.
 */
export type CanalEmpaquetado =
  | [nombre: string, grupo: number, logoUrl: string, streamUrl: string]
  | [nombre: string, grupo: number, logoUrl: string, streamUrl: string, guia: GuiaEmpaquetada, respaldo?: string]
  | [nombre: string, grupo: number, logoUrl: string, streamUrl: string, respaldo: string];

/**
 * Tema y país de un grupo de canales, más la categoría de numeración.
 *
 * Es la forma de mandar el tema y el país **sin un campo nuevo por canal**
 * (decisión cerrada: cada campo viaja con cada uno de los 7.822). La tupla ya
 * tenía un hueco con un número —el índice de la categoría—; ahora ese número
 * apunta aquí, a una combinación que viaja una sola vez. En la lista por
 * defecto son unas quinientas combinaciones para 4.816 canales.
 *
 * La categoría vieja sigue dentro porque de ella salen el NÚMERO de canal y la
 * posición —y la posición es el `id` que guardan los favoritos—. Renumerar es
 * decisión del dueño (§2.5 del informe); hasta entonces no se mueve nada.
 */
export type ParEmpaquetado = [tema: number, pais: string, categoria: number];

/**
 * Lo que hace falta para reconstruir un canal que **no viaja solo**: en un
 * paquete recortado faltan canales por el camino, así que ni la posición ni el
 * número IPTV se pueden deducir y los dos viajan.
 *
 * Arrays paralelos y no dos huecos por tupla: así son mil bytes que solo
 * existen en el paquete pequeño y ni uno en el completo, que es el que pesa.
 */
export interface RecorteCanales {
  /** Posición de cada canal dentro de la lista completa. De ahí sale el `id`. */
  posiciones: number[];
  /** Cuántos canales de su categoría le preceden, más uno. De ahí, el número. */
  ordinales: number[];
}

export interface PaqueteCanales {
  /**
   * Versión del formato. Sin ella es la 1: el segundo hueco de cada tupla
   * apunta a `categorias`. Con `2`, apunta a `pares`.
   *
   * `/api/canales` se cachea en el borde (cinco minutos, y hasta una hora
   * sirviendo la copia vieja), así que un JS nuevo puede recibir un paquete
   * viejo y al revés: `desempaquetarCanales` entiende los dos.
   */
  v?: 2;
  /** Las categorías de numeración, una sola vez. */
  categorias: string[];
  /**
   * Cuántos canales tiene cada categoría **en la lista completa**, aunque este
   * paquete solo traiga unos pocos. Es lo que pinta la columna de categorías.
   */
  cuentas: number[];
  /** v2: los temas que aparecen, una vez. `pares[i][0]` apunta aquí. */
  temas?: string[];
  /** v2: tema × país × categoría. El segundo hueco de cada tupla apunta aquí. */
  pares?: ParEmpaquetado[];
  /**
   * v2: cuántos canales de cada par hay **en la lista completa**. De aquí sale
   * «Ver los 527 de Sudamérica» aunque solo hayan viajado doce.
   */
  cuentasPares?: number[];
  /** Cuántos canales hay en total en la lista completa. */
  total: number;
  canales: CanalEmpaquetado[];
  /** Presente solo si el paquete está recortado. Ver `RecorteCanales`. */
  recorte?: RecorteCanales;
}

/**
 * Lo que hace falta de un canal para empaquetarlo. `tema` y `pais` los pone
 * `m3u.ts` y solo existen en el servidor; aquí `category` es todavía la
 * categoría de numeración.
 */
export type CanalDeOrigen = Omit<Channel, "id" | "number"> & { tema?: string; pais?: string };

/**
 * Del lado del servidor: objetos → tuplas.
 *
 * Las categorías salen de las que de verdad aparecen, no de `CATEGORY_ORDER`
 * entera: una lista M3U puede traer una categoría que no esté en el orden
 * conocido, y perderla al empaquetar cambiaría la clasificación. Lo mismo con
 * los temas y los pares.
 */
export function empaquetarCanales(canales: CanalDeOrigen[]): PaqueteCanales {
  const indices = new Map<string, number>();
  const categorias: string[] = [];
  const cuentas: number[] = [];
  const indiceDeTema = new Map<string, number>();
  const temas: string[] = [];
  const indiceDePar = new Map<string, number>();
  const pares: ParEmpaquetado[] = [];
  const cuentasPares: number[] = [];

  const empaquetados = canales.map((canal): CanalEmpaquetado => {
    let indice = indices.get(canal.category);
    if (indice === undefined) {
      indice = categorias.length;
      indices.set(canal.category, indice);
      categorias.push(canal.category);
      cuentas.push(0);
    }
    cuentas[indice] += 1;

    const tema = canal.tema || temaPorNombre(canal.name);
    let indiceTema = indiceDeTema.get(tema);
    if (indiceTema === undefined) {
      indiceTema = temas.length;
      indiceDeTema.set(tema, indiceTema);
      temas.push(tema);
    }
    const pais = canal.pais ?? "";
    const clavePar = `${indiceTema}|${pais}|${indice}`;
    let par = indiceDePar.get(clavePar);
    if (par === undefined) {
      par = pares.length;
      indiceDePar.set(clavePar, par);
      pares.push([indiceTema, pais, indice]);
      cuentasPares.push(0);
    }
    cuentasPares[par] += 1;

    const guia = guiaDe(canal);
    const respaldo = canal.streamUrlBackup || undefined;
    if (guia && respaldo) return [canal.name, par, canal.logoUrl, canal.streamUrl, guia, respaldo];
    if (guia) return [canal.name, par, canal.logoUrl, canal.streamUrl, guia];
    // Sin guía el respaldo ocupa el quinto hueco como cadena: ver el tipo.
    if (respaldo) return [canal.name, par, canal.logoUrl, canal.streamUrl, respaldo];
    return [canal.name, par, canal.logoUrl, canal.streamUrl];
  });

  return {
    v: 2,
    categorias,
    cuentas,
    temas,
    pares,
    cuentasPares,
    total: empaquetados.length,
    canales: empaquetados,
  };
}

/**
 * La categoría de numeración de una tupla, sea cual sea la versión: en la 1
 * el hueco ES la categoría; en la 2 hay que pasar por el par.
 */
function categoriaDeTupla(paquete: PaqueteCanales, grupo: number): number {
  if (paquete.v === 2) return paquete.pares?.[grupo]?.[2] ?? -1;
  return grupo;
}

/**
 * Las categorías viejas que sí eran un tema, para entender un paquete v1. Las
 * demás —Guatemala, Español, Inglés, Internacional, General— decían de dónde
 * era el canal o nada, y ahí se pregunta al nombre.
 */
const TEMA_DE_CATEGORIA_V1: Record<string, Tema> = {
  Deportes: "Deportes",
  Noticias: "Noticias",
  "Películas y series": "Películas y series",
  Documentales: "Documentales",
  Infantil: "Infantil",
  Música: "Música",
  Religión: "Religión",
  Entretenimiento: "Variedades",
};

/** Tema y país de una tupla, también si el paquete es v1. */
export function fichaDeTupla(paquete: PaqueteCanales, tupla: CanalEmpaquetado): Ficha {
  const [nombre, grupo] = tupla;
  if (paquete.v === 2) {
    const par = paquete.pares?.[grupo];
    const tema = par ? paquete.temas?.[par[0]] : undefined;
    return {
      nombre,
      tema: tema && esTema(tema) ? tema : temaPorNombre(nombre),
      pais: par?.[1] ?? "",
    };
  }
  const categoria = paquete.categorias[grupo] ?? "";
  return {
    nombre,
    tema: TEMA_DE_CATEGORIA_V1[categoria] ?? temaPorNombre(nombre),
    // Lo único que un paquete v1 sabe del país: la categoría Guatemala.
    pais: categoria === "Guatemala" ? "gt" : "",
  };
}

/** Los cinco campos de guía, o nada si el canal no trae ninguno. */
function guiaDe(canal: CanalDeOrigen): GuiaEmpaquetada | undefined {
  const guia: GuiaEmpaquetada = {};
  if (canal.currentProgram !== undefined) guia.currentProgram = canal.currentProgram;
  if (canal.nextProgram !== undefined) guia.nextProgram = canal.nextProgram;
  if (canal.currentStart !== undefined) guia.currentStart = canal.currentStart;
  if (canal.currentEnd !== undefined) guia.currentEnd = canal.currentEnd;
  if (canal.nextStart !== undefined) guia.nextStart = canal.nextStart;
  return Object.keys(guia).length > 0 ? guia : undefined;
}

/**
 * Posición de una categoría dentro del orden conocido.
 *
 * Las que no estén en `CATEGORY_ORDER` van al final, que es el mismo criterio
 * que usaba `withChannelNumbers`.
 */
function ordenDeCategoria(categoria: string): number {
  const indice = CATEGORY_ORDER.indexOf(categoria as (typeof CATEGORY_ORDER)[number]);
  return indice + 1 || CATEGORY_ORDER.length;
}

/**
 * Del lado del navegador: tuplas → `Channel[]`, numerando por el camino y en
 * **una sola pasada**. Antes eran dos, y la segunda clonaba los 7.822 objetos
 * enteros solo para reescribirles el número recién recibido.
 *
 * **El `id` que sale es el mismo con paquete completo y recortado**, y no es un
 * detalle: favoritos e historial se guardan por `id` en `localStorage`, así que
 * si el recorte cambiara la numeración cada favorito apuntaría a otro canal.
 *
 * **`category` sale con el TEMA** («Noticias», «Generalista»…), no con la
 * categoría de numeración: es lo que todas las pantallas enseñan junto al
 * canal, y la vieja enseñaba «Internacional» en la mitad de la lista. La de
 * numeración solo sirve para el número, y se usa aquí mismo. El país no tiene
 * campo: se apunta aparte con `anotarPais` (ver `origenes.ts`).
 */
export function desempaquetarCanales(paquete: PaqueteCanales): Channel[] {
  const vistos = new Map<number, number>();
  const recorte = paquete.recorte;

  const canales = paquete.canales.map((tupla, indice) => {
    const [nombre, grupo, logoUrl, streamUrl, quinto, sexto] = tupla as unknown as [
      string,
      number,
      string,
      string,
      GuiaEmpaquetada | string | undefined,
      string | undefined,
    ];
    // Quinto como cadena = respaldo sin guía; como objeto = guía (y el sexto,
    // si es cadena, el respaldo).
    const guia = typeof quinto === "object" && quinto !== null ? (quinto as GuiaEmpaquetada) : undefined;
    const respaldo =
      typeof quinto === "string" ? quinto : typeof sexto === "string" ? sexto : undefined;
    const indiceCategoria = categoriaDeTupla(paquete, grupo);
    const categoria = paquete.categorias[indiceCategoria] ?? "Entretenimiento";
    const centena = ordenDeCategoria(categoria) * 100;
    const { tema, pais } = fichaDeTupla(paquete, tupla);

    let dentro: number;
    if (recorte) {
      dentro = recorte.ordinales[indice] ?? indice + 1;
    } else {
      dentro = (vistos.get(indiceCategoria) ?? 0) + 1;
      vistos.set(indiceCategoria, dentro);
    }

    const canal: Channel = {
      id: (recorte ? (recorte.posiciones[indice] ?? indice) : indice) + 1,
      name: nombre,
      number: String(centena + dentro),
      category: tema,
      logoUrl,
      streamUrl,
    };
    if (respaldo) canal.streamUrlBackup = respaldo;
    anotarPais(canal, pais);
    return guia ? Object.assign(canal, guia) : canal;
  });

  RECUENTOS_DE_LISTA.set(canales, recuentosDe(paquete));
  return canales;
}

/**
 * Los recuentos de la lista COMPLETA, colgados del array que devolvió
 * `desempaquetarCanales`. Inicio recibe los canales y no el paquete, y aun así
 * tiene que decir «Ver los 27 ›» con el recorte del HTML en la mano.
 */
const RECUENTOS_DE_LISTA = new WeakMap<Channel[], Map<string, number>>();

export function recuentosDeLista(canales: Channel[]): Map<string, number> | undefined {
  return RECUENTOS_DE_LISTA.get(canales);
}

/**
 * Quedarse con unos pocos canales sin perder de vista la lista entera. Es el
 * recorte grande de peso: el HTML llevaba 7.822 canales para pintar unos 200.
 * El resto llega por `/api/canales`, cacheable en el borde.
 *
 * **No** se recortan `categorias`, `cuentas`, `pares` ni `total`: son pocos
 * números y son lo que hace que una sección diga «Ver los 527» y no «Ver los
 * 12».
 */
export function recortarPaquete(paquete: PaqueteCanales, posiciones: number[]): PaqueteCanales {
  const buscadas = new Set(
    posiciones.filter((posicion) => posicion >= 0 && posicion < paquete.canales.length),
  );
  const orden = [...buscadas].sort((a, b) => a - b);

  // El ordinal hay que contarlo sobre la lista COMPLETA: es lo que da el número
  // de canal, y contarlo sobre el recorte daría 101, 102, 103… para canales que
  // en la lista de verdad son el 101, el 340 y el 512.
  const ordinales = new Map<number, number>();
  const vistos = new Map<number, number>();
  paquete.canales.forEach(([, grupo], posicion) => {
    const indiceCategoria = categoriaDeTupla(paquete, grupo);
    const dentro = (vistos.get(indiceCategoria) ?? 0) + 1;
    vistos.set(indiceCategoria, dentro);
    if (buscadas.has(posicion)) ordinales.set(posicion, dentro);
  });

  return {
    // Las tablas viajan enteras: son pocas y son lo que da los totales.
    ...(paquete.v === 2
      ? { v: 2 as const, temas: paquete.temas, pares: paquete.pares, cuentasPares: paquete.cuentasPares }
      : {}),
    categorias: paquete.categorias,
    cuentas: paquete.cuentas,
    total: paquete.total,
    canales: orden.map((posicion) => paquete.canales[posicion]),
    recorte: {
      posiciones: orden,
      ordinales: orden.map((posicion) => ordinales.get(posicion) ?? 1),
    },
  };
}

/**
 * Cuántos canales pintan de verdad las dos pantallas nada más abrir.
 *
 * Vive aquí, y no en cada componente, porque es **lo que el servidor decide
 * mandar**. Si Canales subiera sus filas por sección y esto se quedara atrás,
 * la lista abriría corta hasta que llegara el resto; con un solo sitio, no
 * puede pasar.
 */
export const QUE_SE_PINTA: CanalesQuePintan = { porSeccion: 8, grupos: 6, porGrupo: 20 };

export interface CanalesQuePintan {
  /** Cuántos canales enseña cada sección abierta de Canales antes de «Ver los N». */
  porSeccion: number;
  /** Cuántos rieles de canales pinta Inicio (ver `RIELES_DE_INICIO`). */
  grupos: number;
  /** Cuántos canales lleva cada uno de esos rieles. */
  porGrupo: number;
  /** Posiciones sueltas que hay que incluir igualmente (el canal de arranque). */
  ademas?: number[];
}

/**
 * Margen por sección sobre `porSeccion`. Lo que va arriba depende de cosas que
 * el servidor no sabe —qué canales han caído en este aparato y bajan al final,
 * y que la casa se salta en su región—, así que se mandan unos pocos de más
 * para que la primera pantalla no abra con la sección corta.
 */
const HOLGURA_POR_SECCION = 4;

/** Una sola cuenta por paquete: el paquete se reutiliza cinco minutos. */
const POSICIONES_CALCULADAS = new WeakMap<PaqueteCanales, Map<string, number[]>>();

/**
 * Las posiciones que las dos pantallas pintan al abrir, ni un canal más:
 * los de la casa, la cabeza de cada sección abierta de Canales y la de cada
 * riel de Inicio. Se ordenan con las MISMAS funciones que usan las pantallas
 * (`secciones-canales.ts`): si no, Inicio pediría canales que no viajaron.
 */
export function posicionesIniciales(
  paquete: PaqueteCanales,
  { porSeccion, grupos, porGrupo, ademas = [] }: CanalesQuePintan,
): number[] {
  const claveCalculo = `${porSeccion}|${grupos}|${porGrupo}|${ademas.join(",")}`;
  const guardadas = POSICIONES_CALCULADAS.get(paquete)?.get(claveCalculo);
  if (guardadas) return guardadas;

  const casa = normalizarCasa(publicConfig.canalesDeCasa);
  const posiciones = new Set<number>();
  const fichas = paquete.canales.map((tupla, posicion) => ({
    posicion,
    ficha: fichaDeTupla(paquete, tupla),
  }));
  const fichaDe = (item: { ficha: Ficha }) => item.ficha;

  for (const posicion of ademas) {
    if (posicion >= 0 && posicion < paquete.canales.length) posiciones.add(posicion);
  }

  // Las secciones abiertas de Canales: la casa sale sola, porque es lo
  // primero de cada orden curado.
  for (const region of REGIONES_ABIERTAS) {
    const deLaRegion = fichas.filter((item) => regionDePais(item.ficha.pais) === region);
    const cabeza = ordenarFichas(deLaRegion, fichaDe, casa).slice(
      0,
      porSeccion + casa.length + HOLGURA_POR_SECCION,
    );
    for (const { posicion } of cabeza) posiciones.add(posicion);
  }

  for (const { items } of rielesDeInicio(fichas, fichaDe, casa, { porRiel: porGrupo }).slice(0, grupos)) {
    for (const { posicion } of items) posiciones.add(posicion);
  }

  const resultado = [...posiciones].sort((a, b) => a - b);
  const porPaquete = POSICIONES_CALCULADAS.get(paquete) ?? new Map<string, number[]>();
  porPaquete.set(claveCalculo, resultado);
  POSICIONES_CALCULADAS.set(paquete, porPaquete);
  return resultado;
}

/**
 * Cuántos canales hay de cada cosa en la lista completa: por categoría de
 * numeración (como siempre) y, con un paquete v2, por región y tema con las
 * claves de `claveDeRecuento`.
 */
export function recuentosDe(paquete: PaqueteCanales): Map<string, number> {
  const recuentos = new Map(
    paquete.categorias.map((categoria, i) => [categoria, paquete.cuentas[i] ?? 0] as [string, number]),
  );
  if (paquete.v !== 2 || !paquete.pares) return recuentos;

  const sumar = (clave: string, cuantos: number) =>
    recuentos.set(clave, (recuentos.get(clave) ?? 0) + cuantos);
  paquete.pares.forEach(([indiceTema, pais], i) => {
    const cuantos = paquete.cuentasPares?.[i] ?? 0;
    const tema = paquete.temas?.[indiceTema] ?? "Otros";
    const region = regionDePais(pais);
    sumar(claveDeRecuento(region, null), cuantos);
    sumar(claveDeRecuento(region, tema), cuantos);
    sumar(claveDeRecuento(null, tema), cuantos);
    sumar(claveDeRecuento(null, null), cuantos);
  });
  return recuentos;
}
