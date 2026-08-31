import type { Channel } from "@/lib/types";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";
import { channelMark } from "@/lib/channels";
import { porcentaje, valeLaPena, type MemoriaProgreso } from "@/lib/progreso";

/**
 * Lo mínimo que una tarjeta necesita saber para pintarse.
 *
 * CanalCasa maneja dos mundos que no se parecen: `Channel`, que es una señal en
 * vivo con número y categoría, y `ResolvedCatalogItem`, que es una ficha de TMDB
 * con póster y sinopsis.
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
  /** 0-100. Pinta la barra de progreso sobre el arte. */
  progress?: number;
  /** Monograma de respaldo cuando no hay ninguna imagen. */
  mark?: string;
}

/**
 * **Aquí NO va la sinopsis.** La tuvo, con el comentario «solo la usa el hero»
 * — y era verdad a medias: el hero recibe la ficha completa
 * (`ResolvedCatalogItem`), no una tarjeta, así que este campo no lo leía nadie.
 * Mientras tanto viajaba en los 200 títulos del catálogo, y una sinopsis de
 * TMDB son 300-600 caracteres.
 *
 * La regla es la misma que en `types.ts` para los canales: si un campo no se
 * pinta, no se manda.
 */

/**
 * Un canal en vivo visto como tarjeta.
 *
 * Tenía un `options.live` que ponía un distintivo «EN VIVO», y **nadie lo pasó
 * nunca**. No es casualidad ni olvido: en esta app todos los canales están en
 * vivo, así que el distintivo no distinguiría nada. Es la misma razón por la
 * que `isLive` se retiró de `Channel` — valía `true` en los 7.822.
 */
export function channelToCard(channel: Channel): CardItem {
  return {
    key: `canal-${channel.id}`,
    title: channel.name,
    // Los canales no traen arte apaisado: el logo hace de las dos cosas y el
    // CSS lo encaja centrado. Si tampoco hay logo queda el monograma.
    backdrop: channel.logoUrl || null,
    poster: channel.logoUrl || null,
    meta: channel.currentProgram || channel.category,
    metaRight: channel.number,
    mark: channelMark(channel),
  };
}

/**
 * La misma tarjeta, con la barra de por dónde iba.
 *
 * La clave de una tarjeta del catálogo (`movie-123`) y la de su progreso son la
 * misma cadena a propósito: `claveDeTitulo()` produce ese formato, así que
 * cruzarlas es una búsqueda directa y no hay que llevar un índice aparte.
 *
 * Esto no puede hacerse en el servidor —el progreso vive en `localStorage` de
 * cada aparato— así que lo aplica quien pinta, ya en el navegador.
 *
 * Los episodios se guardan con su propia clave (`tv-42-t1e3`), que no coincide
 * con la de la serie (`tv-42`): la tarjeta de una serie no enseña la barra del
 * capítulo suelto que alguien dejó a medias. Es lo correcto — una serie no está
 * «al 40%» porque su tercer capítulo lo esté.
 */
export function conProgreso(item: CardItem, memoria: MemoriaProgreso): CardItem {
  const marca = memoria[item.key];
  if (!marca || !valeLaPena(marca)) return item;
  return { ...item, progress: porcentaje(marca) };
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
  };
}
