import type { Channel } from "@/lib/types";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";
import { channelMark } from "@/lib/channels";
import { claveDeTitulo, porcentaje, valeLaPena, type MemoriaProgreso } from "@/lib/progreso";
import { resumen, type EnCurso } from "@/lib/continuar";

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
  /** Está en «Mi lista» de este aparato. Ver `conEnLista`. */
  enLista?: boolean;
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
 * La clave de una tarjeta del catálogo (`movie-tmdb-550`) y la de su progreso
 * son la misma cadena a propósito: `claveDeTitulo()` la deriva de esta, así que
 * cruzarlas es una búsqueda directa y no hay que llevar un índice aparte.
 *
 * Lo fueron *a propósito* mucho antes de serlo de verdad: `claveDeTitulo()`
 * reconstruía la clave desde el `tmdbId` y producía `movie-550`, así que esta
 * búsqueda fallaba siempre y ninguna tarjeta enseñó nunca su barra. Derivar una
 * de la otra es lo que impide que vuelvan a separarse.
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

/**
 * La clave de un título del catálogo, compartida por la tarjeta
 * (`catalogToCard`) y por «Mi lista» (`use-watchlist.ts`).
 *
 * Con el `id` a secas, una película y una serie con el mismo `tmdbId`
 * chocarían en el mismo `Set`; con el `mediaType` delante, no.
 */
export function claveCatalogo(item: Pick<ResolvedCatalogItem, "mediaType" | "id">): string {
  return `${item.mediaType}-${item.id}`;
}

/** Una ficha del catálogo vista como tarjeta. */
export function catalogToCard(item: ResolvedCatalogItem): CardItem {
  return {
    key: claveCatalogo(item),
    title: item.title,
    backdrop: item.backdrop ?? item.poster ?? null,
    poster: item.poster ?? item.backdrop ?? null,
    meta: item.mediaType === "tv" ? "Serie" : "Película",
    metaRight: item.year ? String(item.year) : undefined,
    mark: item.title.slice(0, 2).toUpperCase(),
  };
}

/**
 * La misma tarjeta, marcada si está en «Mi lista».
 *
 * Mismo patrón que `conProgreso`: devuelve el MISMO objeto cuando no hay nada
 * que cambiar, para no invalidar el `memo` de `MediaCard` en cada tarjeta de
 * un riel entero por marcar una sola.
 */
export function conEnLista(item: CardItem, ids: Set<string>): CardItem {
  const marcado = ids.has(item.key);
  if (Boolean(item.enLista) === marcado) return item;
  return { ...item, enLista: marcado };
}

/**
 * «Mi lista»: las tarjetas marcadas, en el orden en que aparecen en las filas
 * curadas. Mismo criterio que `seguirViendo` — sin pedir nada nuevo a TMDB,
 * solo cruza lo que ya llegó con lo que hay en `localStorage`.
 */
export function enMiLista(filas: { tarjetas: CardItem[] }[], ids: Set<string>): CardItem[] {
  const vistas = new Set<string>();
  const resultado: CardItem[] = [];
  for (const fila of filas) {
    for (const tarjeta of fila.tarjetas) {
      if (!ids.has(tarjeta.key) || vistas.has(tarjeta.key)) continue;
      vistas.add(tarjeta.key);
      resultado.push(conEnLista(tarjeta, ids));
    }
  }
  return resultado;
}

/**
 * Un título a medias, visto como tarjeta.
 *
 * Es lo que alimenta «Seguir viendo», y sustituye al `seguirViendo()` que
 * había aquí. La diferencia está en de dónde sale la carátula: aquel solo
 * podía ofrecer títulos que YA vinieran en las filas curadas del servidor —una
 * serie encontrada por el buscador desaparecía de la fila en cuanto salías de
 * su ficha—, y esta guarda la carátula con la entrada, así que la fila se
 * pinta sin pedirle nada a TMDB y sirve para cualquier título.
 *
 * La línea de debajo dice «T1 E4 · Título del capítulo» en vez del año. En una
 * fila de continuar es lo único que importa: por dónde vas.
 */
export function enCursoACard(entrada: EnCurso, memoria: MemoriaProgreso): CardItem {
  /**
   * La barra se busca por la clave del EPISODIO, no por la de la serie: una
   * serie no está «al 40%» porque su cuarto capítulo lo esté, pero la tarjeta
   * que ofrece continuar ese capítulo sí puede decir por dónde iba. Casi
   * siempre no habrá nada guardado —el reproductor solo lee la posición cuando
   * el `<video>` es nuestro— y entonces la tarjeta va sin barra, que es lo
   * correcto: mejor sin barra que con una inventada.
   */
  const clave = claveDeTitulo(entrada.clave, entrada.temporada, entrada.episodio);
  const marca = memoria[clave];

  return {
    key: entrada.clave,
    title: entrada.titulo,
    backdrop: entrada.backdrop ?? entrada.poster,
    poster: entrada.poster ?? entrada.backdrop,
    meta: resumen(entrada),
    mark: entrada.titulo.slice(0, 2).toUpperCase(),
    progress: marca && valeLaPena(marca) ? porcentaje(marca) : undefined,
  };
}
