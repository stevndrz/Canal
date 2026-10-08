import type { Channel } from "@/lib/types";
import { paisDe } from "@/lib/origenes";
import { normalizeChannelName } from "@/lib/text";

/**
 * Claves estables para lo que se guarda de un canal en el aparato: favoritos,
 * recientes y el último canal visto.
 *
 * **Por qué no el `id`.** El `id` es la POSICIÓN del canal en la lista
 * (`canales-empaquetados.ts`). En cuanto la M3U gana o pierde un canal, o se
 * reordena, todos los de detrás se corren uno: un favorito guardado como
 * `id 37` pasa a ser otro canal sin que nadie se entere.
 *
 * **Qué se usa.** Nombre normalizado + país: `canal7.gt`, `espn.us`. Es
 * casi lo mismo que un `tvg-id` de iptv-org (`Canal7.gt@SD`), pero sale de
 * datos que el canal YA tiene en el navegador — `Channel` no gana ningún
 * campo (cada uno viaja 7.822 veces). Sobrevive a:
 *
 * - que la lista cambie de tamaño u orden (el `id` cambia; esto no),
 * - que el proveedor cambie la URL del stream (pasa a menudo con los tokens),
 * - que se renumeren los canales (el número no entra en la clave).
 *
 * Y distingue el Canal 3 de Guatemala (`canal3.gt`) del de Argentina
 * (`canal3.ar`), que solo por nombre serían el mismo.
 *
 * **Colisiones.** En la lista por defecto (4.816 canales) hay 7 claves que
 * comparten dos canales — la misma señal de un país clasificada en dos
 * categorías (EBS 1 de Corea, Aruba TV…). Marcar uno marca los dos. Se acepta:
 * desambiguar con la URL o con el orden haría la clave inestable justo en lo
 * que esta clave existe para evitar.
 */
export function claveDeCanalEstable(canal: Channel): string {
  return `${normalizeChannelName(canal.name)}.${paisDe(canal)}`;
}

/** Clave → ids de los canales que la llevan, en el orden de la lista. */
export type IndiceDeClaves = Map<string, number[]>;

/**
 * Un índice por array de canales, guardado aparte: normalizar 7.822 nombres
 * cuesta, y el mismo array se consulta desde favoritos, recientes y arranque.
 * `WeakMap` para que el recorte del HTML y la lista completa no se pisen y lo
 * viejo se recoja solo.
 */
const INDICES = new WeakMap<readonly Channel[], { porClave: IndiceDeClaves; porId: Map<number, string> }>();

function indice(channels: readonly Channel[]) {
  let guardado = INDICES.get(channels);
  if (!guardado) {
    const porClave: IndiceDeClaves = new Map();
    const porId = new Map<number, string>();
    for (const canal of channels) {
      const clave = claveDeCanalEstable(canal);
      porId.set(canal.id, clave);
      const ids = porClave.get(clave);
      if (ids) ids.push(canal.id);
      else porClave.set(clave, [canal.id]);
    }
    guardado = { porClave, porId };
    INDICES.set(channels, guardado);
  }
  return guardado;
}

/** La clave estable del canal con ese `id` en ESTA lista, o `null`. */
export function claveDeId(channels: readonly Channel[], id: number): string | null {
  return indice(channels).porId.get(id) ?? null;
}

/** Los ids de ESTA lista que corresponden a un conjunto de claves. */
export function idsDeClaves(claves: Iterable<string>, channels: readonly Channel[]): Set<number> {
  const { porClave } = indice(channels);
  const ids = new Set<number>();
  for (const clave of claves) {
    for (const id of porClave.get(clave) ?? []) ids.add(id);
  }
  return ids;
}

/**
 * Lista ordenada de claves → ids, conservando el orden y sin repetir. Para
 * los recientes, donde el orden es la información. Una clave con dos canales
 * da solo el primero: en «Vistos hace poco» no tiene sentido verlo dos veces.
 */
export function idsEnOrden(claves: readonly string[], channels: readonly Channel[]): number[] {
  const { porClave } = indice(channels);
  const ids: number[] = [];
  for (const clave of claves) {
    const id = porClave.get(clave)?.[0];
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Migración del formato viejo (ids posicionales) al nuevo (claves).
 *
 * Los ids guardados se interpretan contra la lista de HOY: es lo único que se
 * puede hacer y es también lo que la persona ve ahora mismo como sus
 * favoritos, así que tras migrar no cambia nada de lo que se ve — solo deja
 * de poder cambiar después.
 *
 * Devuelve `null` si todavía no se puede migrar sin perder nada: con el
 * recorte del HTML (~200 canales) un favorito que no vino en él no se
 * encuentra, y darlo por perdido lo borraría. Hay que esperar a la lista
 * completa; con ella en la mano, un id que no existe es un canal que ya no
 * está y sí se descarta.
 */
export function migrarIdsAClaves(
  idsViejos: readonly number[],
  channels: readonly Channel[],
  listaCompleta: boolean,
): string[] | null {
  if (channels.length === 0) return null;
  const claves: string[] = [];
  for (const id of idsViejos) {
    const clave = claveDeId(channels, id);
    if (clave === null) {
      if (!listaCompleta) return null;
      continue;
    }
    if (!claves.includes(clave)) claves.push(clave);
  }
  return claves;
}

/**
 * Lee lo guardado con cualquiera de los dos formatos.
 *
 * - `string[]` → ya migrado.
 * - `number[]` → el formato viejo, por ids.
 * - cualquier otra cosa (basura, otra versión) → vacío, sin reventar.
 */
export function leerGuardado(crudo: string | null): { claves: string[] } | { ids: number[] } | null {
  if (!crudo) return null;
  try {
    const valor: unknown = JSON.parse(crudo);
    if (!Array.isArray(valor)) return null;
    if (valor.every((v) => typeof v === "string")) return { claves: valor as string[] };
    if (valor.every((v) => typeof v === "number" && Number.isFinite(v))) return { ids: valor as number[] };
    return null;
  } catch {
    return null;
  }
}
