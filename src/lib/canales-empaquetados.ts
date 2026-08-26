import { CATEGORY_ORDER } from "@/lib/categories";
import type { Channel } from "@/lib/types";

/**
 * Cómo viajan los canales del servidor al navegador.
 *
 * La lista se serializa entera dentro del HTML de la portada, y medido sobre
 * el sitio en vivo eso eran **1,88 MB para 7.822 canales**. El desglose por
 * campo dejó claro que la mitad no era información:
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
 * Así que el formato de transporte deja de ser un objeto por canal y pasa a ser
 * una tupla: sin nombres de clave, sin lo que se puede deducir y con la
 * categoría como índice a una tabla que viaja una sola vez.
 *
 * `Channel` no cambia. El resto de la app sigue viendo objetos normales; lo
 * único distinto es **lo que cruza el cable**, y `desempaquetarCanales` los
 * reconstruye en una sola pasada — la misma en la que antes se clonaban los
 * 7.822 objetos solo para reescribirles el número.
 *
 * Sobre esto se apoya el segundo recorte, el grande: un paquete **no tiene por
 * qué traer todos los canales**. Ver `recortarPaquete` más abajo.
 */

/** Los datos de guía, que solo existen si hay EPG configurado. */
export type GuiaEmpaquetada = Pick<
  Channel,
  "currentProgram" | "nextProgram" | "currentStart" | "currentEnd" | "nextStart"
>;

/**
 * Un canal, en el orden en que se empaqueta.
 *
 * El quinto hueco solo aparece con guía; sin ella —el caso por defecto— cada
 * canal son cuatro valores y nada más.
 */
export type CanalEmpaquetado = [
  nombre: string,
  categoria: number,
  logoUrl: string,
  streamUrl: string,
  guia?: GuiaEmpaquetada,
];

/**
 * Lo que hace falta para reconstruir un canal que **no viaja solo**.
 *
 * En un paquete recortado, la posición ya no se puede deducir del índice del
 * array —faltan canales por el camino— y el número IPTV tampoco se puede
 * contar, por el mismo motivo. Así que los dos viajan.
 *
 * Son dos arrays paralelos a `canales` en vez de dos huecos más en cada tupla
 * porque un recorte son ~200 canales: mil bytes que solo existen en el paquete
 * pequeño, y ni uno en el completo, que es el que pesa.
 */
export interface RecorteCanales {
  /** Posición de cada canal dentro de la lista completa. De ahí sale el `id`. */
  posiciones: number[];
  /** Cuántos canales de su categoría le preceden, más uno. De ahí, el número. */
  ordinales: number[];
}

export interface PaqueteCanales {
  /** Las categorías, una sola vez. El índice de cada canal apunta aquí. */
  categorias: string[];
  /**
   * Cuántos canales tiene cada categoría **en la lista completa**, aunque este
   * paquete solo traiga unos pocos. Es lo que pinta la columna de categorías.
   */
  cuentas: number[];
  /** Cuántos canales hay en total en la lista completa. */
  total: number;
  canales: CanalEmpaquetado[];
  /** Presente solo si el paquete está recortado. Ver `RecorteCanales`. */
  recorte?: RecorteCanales;
}

/** Lo que hace falta de un canal para empaquetarlo. */
type CanalDeOrigen = Omit<Channel, "id" | "number">;

/**
 * Del lado del servidor: objetos → tuplas.
 *
 * Las categorías salen de las que de verdad aparecen, no de `CATEGORY_ORDER`
 * entera: una lista M3U puede traer una categoría que no esté en el orden
 * conocido, y perderla al empaquetar cambiaría la clasificación.
 */
export function empaquetarCanales(canales: CanalDeOrigen[]): PaqueteCanales {
  const indices = new Map<string, number>();
  const categorias: string[] = [];
  const cuentas: number[] = [];

  const empaquetados = canales.map((canal): CanalEmpaquetado => {
    let indice = indices.get(canal.category);
    if (indice === undefined) {
      indice = categorias.length;
      indices.set(canal.category, indice);
      categorias.push(canal.category);
      cuentas.push(0);
    }
    cuentas[indice] += 1;

    const guia = guiaDe(canal);
    return guia
      ? [canal.name, indice, canal.logoUrl, canal.streamUrl, guia]
      : [canal.name, indice, canal.logoUrl, canal.streamUrl];
  });

  return { categorias, cuentas, total: empaquetados.length, canales: empaquetados };
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
 * Del lado del navegador: tuplas → `Channel[]`, numerando por el camino.
 *
 * **Una sola pasada.** Antes eran dos: el servidor mandaba `id` y `number`, y
 * el cliente llamaba a `withChannelNumbers`, que clonaba los 7.822 objetos
 * enteros solo para reescribirles el número que acababa de recibir. Aquí el
 * objeto se construye ya con su `id` (la posición) y su número IPTV
 * (101+, 201+, 301+ por categoría), sin clonar nada.
 *
 * En un paquete recortado la posición y el ordinal no se pueden deducir
 * —faltan canales entre medias— así que vienen dados. **El `id` que sale es el
 * mismo en los dos casos**, y eso no es un detalle: los favoritos y el
 * historial se guardan por `id` en `localStorage`, así que si el recorte
 * cambiara la numeración, cada favorito apuntaría a otro canal.
 */
export function desempaquetarCanales(paquete: PaqueteCanales): Channel[] {
  const vistos = new Map<number, number>();
  const recorte = paquete.recorte;

  return paquete.canales.map(([nombre, indiceCategoria, logoUrl, streamUrl, guia], indice) => {
    const category = paquete.categorias[indiceCategoria] ?? "Entretenimiento";
    const centena = ordenDeCategoria(category) * 100;

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
      category,
      logoUrl,
      streamUrl,
    };
    return guia ? Object.assign(canal, guia) : canal;
  });
}

/**
 * Quedarse con unos pocos canales sin perder de vista la lista entera.
 *
 * Es el cambio grande de peso: el HTML de la portada llevaba los 7.822 canales
 * para pintar unos 200. Con esto lleva solo esos 200 —los que Inicio y Canales
 * pintan de verdad— y el resto llega después por `/api/canales`, que es una
 * respuesta cacheable en el borde en vez de HTML rehecho en cada visita.
 *
 * Lo que **no** se recorta es `categorias`, `cuentas` ni `total`: son doce
 * números y son lo que hace que la columna de categorías siga diciendo
 * «Deportes 1.240» y no «Deportes 12» mientras el resto viaja.
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
  paquete.canales.forEach(([, indiceCategoria], posicion) => {
    const dentro = (vistos.get(indiceCategoria) ?? 0) + 1;
    vistos.set(indiceCategoria, dentro);
    if (buscadas.has(posicion)) ordinales.set(posicion, dentro);
  });

  return {
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
 * mandar**. Si `LiveTvView` subiera su lote y esto se quedara atrás, la lista
 * abriría corta hasta que llegara el resto; con un solo sitio, no puede pasar.
 */
export const QUE_SE_PINTA: CanalesQuePintan = { lote: 60, grupos: 6, porGrupo: 20 };

export interface CanalesQuePintan {
  /** Cuántos canales pinta la lista de Canales antes de pedir más. */
  lote: number;
  /** Cuántas categorías ofrece Inicio en rieles. */
  grupos: number;
  /** Cuántos canales lleva cada uno de esos rieles. */
  porGrupo: number;
  /** Posiciones sueltas que hay que incluir igualmente (el canal de arranque). */
  ademas?: number[];
}

/**
 * Las posiciones que las dos pantallas pintan nada más abrir.
 *
 * Es exactamente lo que hay que mandar en el HTML, ni un canal más: los del
 * primer lote de Canales y la cabeza de cada riel de Inicio.
 *
 * El orden de los grupos tiene que ser **el mismo que el de `groupByCategory`**
 * o Inicio pediría rieles que no viajaron. Por eso usa `CATEGORY_ORDER.indexOf`
 * en crudo, con su −1 para las categorías desconocidas, en vez del
 * `ordenDeCategoria` de aquí arriba, que las manda al final.
 */
export function posicionesIniciales(
  paquete: PaqueteCanales,
  { lote, grupos, porGrupo, ademas = [] }: CanalesQuePintan,
): number[] {
  const posiciones = new Set<number>();

  for (let i = 0; i < Math.min(lote, paquete.canales.length); i += 1) posiciones.add(i);
  for (const posicion of ademas) {
    if (posicion >= 0 && posicion < paquete.canales.length) posiciones.add(posicion);
  }

  const cupo = new Map(
    paquete.categorias
      .map((categoria, indice) => ({ categoria, indice }))
      .sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a.categoria as (typeof CATEGORY_ORDER)[number]) -
          CATEGORY_ORDER.indexOf(b.categoria as (typeof CATEGORY_ORDER)[number]),
      )
      .slice(0, grupos)
      .map(({ indice }) => [indice, porGrupo] as const),
  );

  paquete.canales.forEach(([, indiceCategoria], posicion) => {
    const quedan = cupo.get(indiceCategoria);
    if (quedan === undefined || quedan <= 0) return;
    cupo.set(indiceCategoria, quedan - 1);
    posiciones.add(posicion);
  });

  return [...posiciones].sort((a, b) => a - b);
}

/** Cuántos canales tiene cada categoría en la lista completa. */
export function recuentosDe(paquete: PaqueteCanales): Map<string, number> {
  return new Map(paquete.categorias.map((categoria, i) => [categoria, paquete.cuentas[i] ?? 0]));
}
