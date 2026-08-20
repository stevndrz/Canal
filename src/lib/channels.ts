import type { Channel } from "@/lib/types";
import { CATEGORY_ORDER } from "@/lib/categories";
import { normalizeChannelName } from "@/lib/text";
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

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export interface ChannelQuery {
  search?: string;
  category?: string;
  favoritesOnly?: boolean;
  favorites?: Set<number>;
}

export function filterChannels(channels: Channel[], query: ChannelQuery): Channel[] {
  const q = fold((query.search ?? "").trim());
  const { category, favoritesOnly, favorites } = query;

  return channels.filter((channel) => {
    if (favoritesOnly && !favorites?.has(channel.id)) return false;
    if (category && category !== "Todas" && channel.category !== category) return false;
    if (!q) return true;
    return fold(channel.name).includes(q) || channel.number.startsWith(q);
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
 * Nombre del canal con el que abre la aplicación.
 *
 * Se configura con `NEXT_PUBLIC_CANAL_INICIAL` (ver `src/lib/config.ts`).
 * Es una preferencia, no una garantía: si ese canal no está en la lista de hoy
 * se cae al primero, que tras el orden por importancia de `m3u.ts` ya es el más
 * relevante.
 */

/** El canal sintonizado al arrancar: el preferido si está, si no el primero. */
export function canalDeArranque(channels: Channel[]): number | null {
  if (channels.length === 0) return null;
  const buscado = normalizeChannelName(publicConfig.canalInicial);
  const preferido = channels.find((channel) => normalizeChannelName(channel.name) === buscado);
  return (preferido ?? channels[0]).id;
}
