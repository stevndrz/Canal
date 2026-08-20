import type { Channel } from "@/lib/types";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";
import { channelMark } from "@/lib/channels";

/**
 * Lo mínimo que una tarjeta necesita saber para pintarse.
 *
 * CanalCasa maneja dos mundos que no se parecen: `Channel`, que es una señal en
 * vivo con número y categoría, y `ResolvedCatalogItem`, que es una ficha de TMDB
 * con póster y sinopsis. ARVIO tiene un único `MediaItem` porque todo su
 * contenido viene del mismo sitio.
 *
 * En vez de forzar esos dos tipos a ser uno —que obligaría a tocar el parser de
 * M3U y el catálogo entero—, ambos se traducen aquí a la forma que la tarjeta
 * consume. La tarjeta no sabe si está pintando un canal o una película, y los
 * dos subsistemas siguen siendo dueños de sus propios tipos.
 */
export interface CardItem {
  /** Estable dentro de un riel; es la `key` de React. */
  key: string;
  title: string;
  /** Arte apaisado 16:9, el modo por defecto de la tarjeta. */
  backdrop: string | null;
  /** Póster 2:3, para el modo `is-poster`. */
  poster: string | null;
  /** Línea inferior izquierda: categoría, año, lo que identifique la ficha. */
  meta: string;
  /** Línea inferior derecha: duración, nota, número de canal. */
  metaRight?: string;
  /** Distintivo de la esquina superior derecha, ej. "EN VIVO". */
  badge?: string;
  /** 0-100. Pinta la barra de progreso sobre el arte. */
  progress?: number;
  /** Monograma de respaldo cuando no hay ninguna imagen. */
  mark?: string;
  /** Sinopsis; solo la usa el hero. */
  overview?: string;
}

/** Un canal en vivo visto como tarjeta. */
export function channelToCard(channel: Channel, options?: { live?: boolean }): CardItem {
  return {
    key: `canal-${channel.id}`,
    title: channel.name,
    // Los canales no traen arte apaisado: el logo hace de las dos cosas y el
    // CSS lo encaja centrado. Si tampoco hay logo queda el monograma.
    backdrop: channel.logoUrl || null,
    poster: channel.logoUrl || null,
    meta: channel.currentProgram || channel.category,
    metaRight: channel.number,
    badge: options?.live ? "EN VIVO" : undefined,
    mark: channelMark(channel),
  };
}

/** Una ficha del catálogo vista como tarjeta. */
export function catalogToCard(item: ResolvedCatalogItem): CardItem {
  return {
    key: `${item.mediaType}-${item.id}`,
    title: item.title,
    backdrop: item.backdrop ?? item.poster ?? null,
    poster: item.poster ?? item.backdrop ?? null,
    meta: item.mediaType === "tv" ? "Serie" : "Película",
    metaRight: item.year ? String(item.year) : undefined,
    mark: item.title.slice(0, 2).toUpperCase(),
    overview: item.overview,
  };
}
