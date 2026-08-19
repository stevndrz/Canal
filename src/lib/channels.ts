import type { Channel } from "@/lib/types";

/** Orden de categorías: el mismo CATEGORY_PRIORITY de src/lib/m3u.ts. */
export const CATEGORY_ORDER = [
  "Guatemala",
  "Deportes",
  "Noticias",
  "Películas y series",
  "Infantil",
  "Música",
  "Religión",
  "Entretenimiento",
  "Español",
  "Inglés",
  "Internacional",
  "General",
];

/**
 * Renumera al estilo IPTV: 101+, 201+, 301+ por categoría.
 * Con 500+ canales un índice plano (1..N) no dice nada; la centena sí.
 * m3u.ts ya deja los canales ordenados por CATEGORY_PRIORITY + nombre,
 * así que sólo hay que asignar el número.
 */
export function withChannelNumbers(channels: Channel[]): Channel[] {
  const seen = new Map<string, number>();
  return channels.map((channel) => {
    const base = (CATEGORY_ORDER.indexOf(channel.category) + 1 || CATEGORY_ORDER.length) * 100;
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
    .sort((a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]))
    .map(([category, items]) => ({ category, items }));
}

/** Canal siguiente/anterior con wrap, dentro de la lista visible. */
export function stepChannel(list: Channel[], currentId: number, delta: number) {
  if (list.length === 0) return null;
  const index = list.findIndex((channel) => channel.id === currentId);
  if (index === -1) return list[0];
  return list[(index + delta + list.length) % list.length];
}

/** Marcador de 2 letras cuando la lista no trae logo. */
export function channelMark(channel: Channel) {
  return channel.logoText || channel.name.substring(0, 2).toUpperCase();
}
