import type { Channel } from "@/lib/types";
import { CATEGORY_ORDER } from "@/lib/categories";
import { normalizeChannelName } from "@/lib/text";
import { claveDeCanalEstable, idsEnOrden } from "@/lib/claves-canal";
import { publicConfig } from "@/lib/config";
import { NOMBRE_DE_REGION, REGIONES } from "@/lib/origenes";
import { apartarCaidos, type IndiceSecciones } from "@/lib/secciones-canales";

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

// La numeración vive en `numeracion.ts` (fijos de Guatemala + un bloque por
// región). La de centenas por categoría, `withChannelNumbers`, se retiró:
// repetía 885 números con la lista por defecto.

// `filterChannels` (nombre o prefijo del n\u00famero, con categor\u00eda) se retir\u00f3: la
// b\u00fasqueda de canales vive en `buscar-canales.ts`, por niveles de relevancia y
// con \u00edndice, y la categor\u00eda ya no es estado del shell.

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

/**
 * Canal siguiente/anterior dentro de la lista de zapeo, SIN dar la vuelta.
 *
 * Antes daba la vuelta al llegar a un extremo, y con la lista entera como
 * contexto eso era un desastre: al arrancar la tele en Canal 7, ↑↑ pasaba por
 * Canal 3 y saltaba a «餘姚姚江文化», el último de 4.816. En un extremo ahora
 * no pasa nada (`null`), y es el contexto (`ampliarTramo`) quien decide si
 * después viene otra sección.
 */
export function stepChannel(list: Channel[], currentId: number, delta: number): Channel | null {
  if (list.length === 0) return null;
  const index = list.findIndex((channel) => channel.id === currentId);
  if (index === -1) return list[0];
  return list[index + delta] ?? null;
}

/* ── Contexto de zapeo ──────────────────────────────────────────────────── */

/**
 * Un trozo de lo que se recorre con ↑/↓ y Canal+/−: «Mis canales y
 * Guatemala», «Centroamérica»… o los resultados de una búsqueda.
 */
export interface SeccionZapeo {
  clave: string;
  titulo: string;
  canales: Channel[];
}

/**
 * Qué secciones están en juego ahora, por posición (las dos incluidas).
 *
 * Posiciones y no canales a propósito: cuando llega la lista completa los
 * objetos `Channel` cambian, pero la cadena de secciones es la misma y en el
 * mismo orden, así que el tramo sigue señalando lo mismo.
 */
export interface TramoZapeo {
  desde: number;
  hasta: number;
}

/** Los canales del tramo, en orden y sin repetir (un favorito sale una vez). */
export function canalesDelTramo(secciones: readonly SeccionZapeo[], tramo: TramoZapeo): Channel[] {
  const vistos = new Set<number>();
  const lista: Channel[] = [];
  for (let i = Math.max(0, tramo.desde); i <= tramo.hasta && i < secciones.length; i++) {
    for (const canal of secciones[i].canales) {
      if (vistos.has(canal.id)) continue;
      vistos.add(canal.id);
      lista.push(canal);
    }
  }
  return lista;
}

/**
 * La sección donde vive un canal: la primera que lo trae. Así un canal de la
 * casa o un favorito cae en «Mis canales y Guatemala», que es desde donde se
 * eligió casi siempre, y uno de Honduras en Centroamérica.
 */
export function tramoDeCanal(secciones: readonly SeccionZapeo[], canalId: number): TramoZapeo | null {
  const indice = secciones.findIndex((seccion) => seccion.canales.some((canal) => canal.id === canalId));
  return indice === -1 ? null : { desde: indice, hasta: indice };
}

/**
 * Al llegar al último canal del tramo, se le suma la sección siguiente (y al
 * primero, la anterior): la próxima ↓ sigue por Centroamérica en vez de
 * quedarse clavada o de saltar al otro lado del mundo. Las secciones vacías
 * se saltan. Devuelve el MISMO objeto si no cambia, para no repintar.
 */
export function ampliarTramo(
  secciones: readonly SeccionZapeo[],
  tramo: TramoZapeo,
  canalId: number,
): TramoZapeo {
  const lista = canalesDelTramo(secciones, tramo);
  if (lista.length === 0) return tramo;
  let { desde, hasta } = tramo;
  if (lista[lista.length - 1].id === canalId) {
    let siguiente = hasta + 1;
    while (siguiente < secciones.length && secciones[siguiente].canales.length === 0) siguiente++;
    if (siguiente < secciones.length) hasta = siguiente;
  }
  if (lista[0].id === canalId) {
    let anterior = desde - 1;
    while (anterior >= 0 && secciones[anterior].canales.length === 0) anterior--;
    if (anterior >= 0) desde = anterior;
  }
  return desde === tramo.desde && hasta === tramo.hasta ? tramo : { desde, hasta };
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
  /**
   * Clave estable (`claves-canal.ts`). Ausente en lo guardado antes de que
   * existiera: entonces se busca por nombre, como siempre.
   */
  clave?: string;
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

  // Ya no está en la lista: se cae a lo de siempre en vez de abrir en un
  // canal cualquiera que hoy ocupe esa posición.
  const guardado = buscarUltimo(channels, ultimo);
  if (guardado !== null) return guardado;

  const buscado = normalizeChannelName(publicConfig.canalInicial);
  const preferido = channels.find((canal) => normalizeChannelName(canal.name) === buscado);
  if (preferido) return preferido.id;

  return (canalesDeCasa(channels)[0] ?? channels[0]).id;
}

/**
 * El último canal guardado, si está en ESTA lista; si no, `null`.
 *
 * Aparte de `canalDeArranque` porque quien arranca necesita distinguir «no
 * estaba» de «me quedo con el de siempre»: con red lenta la primera lista es
 * el recorte de ~200 del HTML, el canal guardado puede no venir en él, y dar
 * el arranque por hecho entonces dejaba la tele en Canal 7 para siempre
 * aunque la lista completa sí lo trajera cuatro segundos después.
 */
export function buscarUltimo(channels: readonly Channel[], ultimo?: UltimoCanal | null): number | null {
  if (!ultimo?.nombre || channels.length === 0) return null;
  const esperado = normalizeChannelName(ultimo.nombre);
  // Primero donde estaba: en el caso normal —la lista no ha cambiado— esto
  // acierta sin recorrer 7.822 canales. Con el recorte, los ids siguen siendo
  // posiciones en la lista completa, así que se busca por id y no por índice.
  const enSuSitio = channels[ultimo.id - 1];
  const mismo = enSuSitio
    ? ultimo.clave
      ? claveDeCanalEstable(enSuSitio) === ultimo.clave
      : normalizeChannelName(enSuSitio.name) === esperado
    : false;
  if (enSuSitio && enSuSitio.id === ultimo.id && mismo) {
    return enSuSitio.id;
  }
  // Se movió de sitio (o la lista es el recorte). Por clave si la hay: el
  // nombre solo confunde el Canal 3 de Guatemala con el de Argentina.
  if (ultimo.clave) {
    const porClave = idsEnOrden([ultimo.clave], channels)[0];
    if (porClave !== undefined) return porClave;
  }
  const movido = channels.find((canal) => normalizeChannelName(canal.name) === esperado);
  return movido ? movido.id : null;
}

/**
 * La cadena de secciones que se zapea, siempre la misma y en el mismo orden:
 * «Mis canales y Guatemala» (la casa y los favoritos delante, sin repetir) y
 * después cada región, de lo cercano a lo lejano. Es el contexto con el que
 * arranca la tele y el de todo canal elegido desde una sección.
 *
 * Siempre las nueve, aunque alguna venga vacía: `TramoZapeo` las señala por
 * posición. Dentro de cada una, el orden de Canales y los caídos al final.
 */
export function cadenaDeZapeo(
  indice: IndiceSecciones,
  misCanales: readonly Channel[],
  caidos: ReadonlySet<number>,
): SeccionZapeo[] {
  const primera: SeccionZapeo = {
    clave: "mios",
    titulo: "Mis canales y Guatemala",
    canales: apartarCaidos([...misCanales, ...(indice.porRegion.get("guatemala") ?? [])], caidos),
  };
  const resto = REGIONES.filter((region) => region !== "guatemala").map(
    (region): SeccionZapeo => ({
      clave: region,
      titulo: NOMBRE_DE_REGION[region],
      canales: apartarCaidos(indice.porRegion.get(region) ?? [], caidos),
    }),
  );
  return [primera, ...resto];
}
