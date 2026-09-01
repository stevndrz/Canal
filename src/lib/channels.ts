import type { Channel } from "@/lib/types";
import { CATEGORY_ORDER } from "@/lib/categories";
import { normalizeChannelName, normalizeText } from "@/lib/text";
import { publicConfig } from "@/lib/config";

// CATEGORY_ORDER vive en categories.ts: es también quien clasifica cada canal
// en m3u.ts, así que una sola lista evita que las dos rutinas se desincronicen
// (antes esta duplicaba el orden a mano y le faltaba "Documentales").
export { CATEGORY_ORDER };

/**
 * Posición de una categoría dentro de CATEGORY_ORDER, con el `as const` del
 * origen: `.category` en Channel es un `string` genérico (viene de un M3U
 * ajeno, no de un enum), así que `indexOf` necesita este cast explícito.
 */
function orderIndex(category: string): number {
  return CATEGORY_ORDER.indexOf(category as (typeof CATEGORY_ORDER)[number]);
}

/**
 * Renumera al estilo IPTV: 101+, 201+, 301+ por categoría.
 * Con 500+ canales un índice plano (1..N) no dice nada; la centena sí.
 * m3u.ts ya deja los canales ordenados por CATEGORY_PRIORITY + nombre,
 * así que sólo hay que asignar el número.
 */
export function withChannelNumbers(channels: Channel[]): Channel[] {
  const seen = new Map<string, number>();
  return channels.map((channel) => {
    const base = (orderIndex(channel.category) + 1 || CATEGORY_ORDER.length) * 100;
    const next = (seen.get(channel.category) ?? 0) + 1;
    seen.set(channel.category, next);
    return { ...channel, number: String(base + next) };
  });
}

export interface ChannelQuery {
  search?: string;
  category?: string;
  favoritesOnly?: boolean;
  favorites?: Set<number>;
}

export function filterChannels(channels: Channel[], query: ChannelQuery): Channel[] {
  const q = normalizeText((query.search ?? "").trim());
  const { category, favoritesOnly, favorites } = query;

  return channels.filter((channel) => {
    if (favoritesOnly && !favorites?.has(channel.id)) return false;
    if (category && category !== "Todas" && channel.category !== category) return false;
    if (!q) return true;
    return normalizeText(channel.name).includes(q) || channel.number.startsWith(q);
  });
}

export function groupByCategory(channels: Channel[]) {
  const groups = new Map<string, Channel[]>();
  channels.forEach((channel) => {
    const list = groups.get(channel.category);
    if (list) list.push(channel);
    else groups.set(channel.category, [channel]);
  });
  return [...groups.entries()]
    .sort((a, b) => orderIndex(a[0]) - orderIndex(b[0]))
    .map(([category, items]) => ({ category, items }));
}

/** Canal siguiente/anterior con wrap, dentro de la lista visible. */
export function stepChannel(list: Channel[], currentId: number, delta: number) {
  if (list.length === 0) return null;
  const index = list.findIndex((channel) => channel.id === currentId);
  if (index === -1) return list[0];
  return list[(index + delta + list.length) % list.length];
}

/**
 * Marcador de 2 letras cuando la lista no trae logo.
 *
 * Se deriva aquí en vez de venir en el canal: era exactamente este cálculo,
 * hecho en el servidor y mandado 7.822 veces al navegador.
 */
export function channelMark(channel: Channel) {
  return channel.name.substring(0, 2).toUpperCase();
}

/**
 * Los canales de la casa, en el orden configurado.
 *
 * Ver `publicConfig.canalesDeCasa`. Se buscan por nombre normalizado, así que
 * aguantan que la lista cambie de orden o de tamaño, y los que no estén en la
 * lista de hoy simplemente no salen.
 */
export function canalesDeCasa(channels: Channel[]): Channel[] {
  if (channels.length === 0) return [];
  const porNombre = new Map(channels.map((canal) => [normalizeChannelName(canal.name), canal]));
  return publicConfig.canalesDeCasa
    .map((nombre) => porNombre.get(normalizeChannelName(nombre)))
    .filter((canal): canal is Channel => Boolean(canal));
}

/**
 * El último canal que se estaba viendo, tal y como se guarda.
 *
 * Se guarda el nombre **además** del id, y no es paranoia: el id es la
 * posición en la lista (ver `canales-empaquetados.ts`), así que en cuanto la
 * lista M3U cambie de tamaño el id guardado apunta a otro canal. Con el nombre
 * se puede comprobar antes de usarlo.
 */
export interface UltimoCanal {
  id: number;
  nombre: string;
}

/**
 * El canal con el que abre la aplicación, por orden de preferencia:
 *
 * 1. **El último que se estaba viendo**, si sigue siendo el mismo canal. Es lo
 *    que hace una tele, y lo que la app no hacía: abría siempre en el mismo
 *    sitio por lejos que te hubieras ido.
 * 2. El configurado en `NEXT_PUBLIC_CANAL_INICIAL`.
 * 3. El primero de los canales de la casa que esté en la lista.
 * 4. El primero de todos, que tras el orden de `m3u.ts` ya es el más relevante.
 */
export function canalDeArranque(
  channels: Channel[],
  ultimo?: UltimoCanal | null,
): number | null {
  if (channels.length === 0) return null;

  if (ultimo?.nombre) {
    const esperado = normalizeChannelName(ultimo.nombre);
    // Primero donde estaba: en el caso normal —la lista no ha cambiado— esto
    // acierta sin recorrer 7.822 canales.
    const enSuSitio = channels[ultimo.id - 1];
    if (enSuSitio && normalizeChannelName(enSuSitio.name) === esperado) return enSuSitio.id;
    // Se movió de sitio: se busca por nombre antes de rendirse.
    const movido = channels.find((canal) => normalizeChannelName(canal.name) === esperado);
    if (movido) return movido.id;
    // Ya no está en la lista: se cae a lo de siempre en vez de abrir en un
    // canal cualquiera que hoy ocupe esa posición.
  }

  const buscado = normalizeChannelName(publicConfig.canalInicial);
  const preferido = channels.find((canal) => normalizeChannelName(canal.name) === buscado);
  if (preferido) return preferido.id;

  return (canalesDeCasa(channels)[0] ?? channels[0]).id;
}
