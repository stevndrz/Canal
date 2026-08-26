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

export interface PaqueteCanales {
  /** Las categorías, una sola vez. El índice de cada canal apunta aquí. */
  categorias: string[];
  canales: CanalEmpaquetado[];
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

  const empaquetados = canales.map((canal): CanalEmpaquetado => {
    let indice = indices.get(canal.category);
    if (indice === undefined) {
      indice = categorias.length;
      indices.set(canal.category, indice);
      categorias.push(canal.category);
    }

    const guia = guiaDe(canal);
    return guia
      ? [canal.name, indice, canal.logoUrl, canal.streamUrl, guia]
      : [canal.name, indice, canal.logoUrl, canal.streamUrl];
  });

  return { categorias, canales: empaquetados };
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
 */
export function desempaquetarCanales(paquete: PaqueteCanales): Channel[] {
  const vistos = new Map<number, number>();

  return paquete.canales.map(([nombre, indiceCategoria, logoUrl, streamUrl, guia], posicion) => {
    const category = paquete.categorias[indiceCategoria] ?? "Entretenimiento";
    const centena = ordenDeCategoria(category) * 100;
    const dentro = (vistos.get(indiceCategoria) ?? 0) + 1;
    vistos.set(indiceCategoria, dentro);

    const canal: Channel = {
      id: posicion + 1,
      name: nombre,
      number: String(centena + dentro),
      category,
      logoUrl,
      streamUrl,
    };
    return guia ? Object.assign(canal, guia) : canal;
  });
}
