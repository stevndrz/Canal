import "server-only";

import { loadM3uPlaylist } from "@/lib/m3u";
import { fetchEpg, getEpgEntry } from "@/lib/epg";
import { empaquetarCanales, type PaqueteCanales } from "@/lib/canales-empaquetados";
import { serverConfig } from "@/lib/config.server";
import type { Channel } from "@/lib/types";

/**
 * La lista de canales, lista para cruzar el cable.
 *
 * Vivía dentro de `page.tsx`. Se separó cuando dejó de tener un solo
 * consumidor: la portada manda **un recorte** en el HTML y `/api/canales`
 * sirve el resto. Los dos tienen que construir exactamente el mismo paquete o
 * los `id` no cuadrarían entre uno y otro — y los `id` son lo que guardan los
 * favoritos.
 */

/** Lo que se guarda entre peticiones para no rehacer el mismo trabajo. */
let memoria: { origen: unknown; paquete: PaqueteCanales; json: string } | null = null;

/**
 * Empaqueta la lista una vez por descarga, no una por visita.
 *
 * `loadM3uPlaylist` ya guarda la lista interpretada cinco minutos, así que
 * devuelve **el mismo array** mientras dure la caché. Eso sirve de llave: si
 * la referencia no ha cambiado, el paquete y su JSON tampoco. Sin esto, cada
 * visita volvía a recorrer y a serializar 7.822 canales para producir bytes
 * idénticos.
 *
 * El JSON se guarda ya en texto porque serializar el paquete completo es lo
 * caro de `/api/canales`, no construirlo.
 *
 * Efecto secundario asumido: la guía queda congelada esos cinco minutos, en
 * vez de recalcularse contra la hora exacta de cada visita. Un programa dura
 * media hora larga; cinco minutos de desfase no los ve nadie desde el sofá.
 */
export async function paqueteDeCanales(): Promise<{ paquete: PaqueteCanales; json: string }> {
  const { channels, epgUrl } = await loadM3uPlaylist();
  if (memoria?.origen === channels) return memoria;

  const conGuia = await conProgramacion(channels, epgUrl);
  const paquete = empaquetarCanales(conGuia);
  const json = JSON.stringify(paquete);

  memoria = { origen: channels, paquete, json };
  return memoria;
}

/**
 * Añade la guía a cada canal, **solo si la hay**.
 *
 * No es cosmético. Esta lista se serializa entera, y React codifica una
 * propiedad presente con valor `undefined` como el texto literal
 * `"$undefined"`. Con tres campos de guía por canal eso eran unos 90 bytes ×
 * 7.822 = **700 KB de decir «aquí no hay nada»**. Sin guía configurada, que es
 * el caso por defecto, las cinco claves desaparecen.
 */
async function conProgramacion(
  canales: Omit<Channel, "id" | "number">[],
  epgDeLaLista: string | null,
): Promise<Omit<Channel, "id" | "number">[]> {
  // La guía es opcional: si la lista M3U no referencia ninguna y no hay EPG_URL
  // configurada, la app funciona igual, solo sin horarios.
  // Cuál de las dos se usa decide también cuánto se la comprueba: la de
  // `EPG_URL` la eligió quien despliega, la de la lista la eligió quien
  // controla esa lista. Ver `fetchEpg`.
  const propia = serverConfig().epgUrl;
  const url = propia || epgDeLaLista || "";
  const epg = url ? await fetchEpg(url, !propia) : null;
  if (!epg) return canales;

  // Corre una vez por descarga en el servidor, no en cada re-render.
  const ahora = Date.now();

  return canales.map((canal) => {
    const entrada = getEpgEntry(epg, "", canal.name, ahora);
    if (!entrada) return canal;

    const base = { ...canal };
    if (entrada.current?.title) base.currentProgram = entrada.current.title;
    if (entrada.next?.title) base.nextProgram = entrada.next.title;
    if (entrada.current?.start !== undefined) base.currentStart = entrada.current.start;
    if (entrada.current?.stop !== undefined) base.currentEnd = entrada.current.stop;
    if (entrada.next?.start !== undefined) base.nextStart = entrada.next.start;
    return base;
  });
}
