import { fetchEpg, programasEnFranja } from "@/lib/epg";
import { serverConfig } from "@/lib/config.server";
import { loadM3uPlaylist } from "@/lib/m3u";
import { excedeLimite, identificarCliente, respuestaLimite } from "@/lib/limite-peticiones";

/**
 * La programación de unos pocos canales, para la parrilla.
 *
 * **Por qué hace falta una ruta y no basta con lo que ya viaja.** Cada canal
 * llega al navegador con cinco campos de guía —lo que dan ahora, lo que viene
 * después y sus horas—, y no más, porque `types.ts` lo prohíbe con un motivo
 * medido: cada campo que se añada a `Channel` **viaja 7.822 veces**, y ya se
 * retiraron cuatro campos que sumaban 1,4 MB. Una parrilla necesita varias
 * horas de programación por canal, o sea decenas de programas donde hoy viajan
 * dos. Mandarlo con la lista sería deshacer ese trabajo entero.
 *
 * Así que la parrilla se paga por lo que se mira: se piden los canales que se
 * ven en pantalla y la franja que se está mirando, y nada más. Bajar por la
 * parrilla pide el siguiente puñado.
 *
 * La respuesta va en tuplas y no en objetos, por lo mismo que
 * `canales-empaquetados.ts`: `[inicio, fin, titulo]` en vez de tres claves
 * repetidas en cada programa.
 */

/**
 * Tope de canales por petición.
 *
 * Es lo que cabe en una pantalla de televisor con holgura para desplazarse.
 * Además de un tope de trabajo, es un tope de amplificación: sin él, esta ruta
 * sería otra forma de hacer que el servidor recorra la guía entera tantas veces
 * como alguien quiera.
 */
const MAX_CANALES = 40;

/** Tope de franja pedida. Tres horas es lo que pinta la parrilla de una vez. */
const MAX_HORAS = 6;

/** Un programa, en tuplas: inicio, fin, título. */
type ProgramaTupla = [number, number, string];

export async function GET(request: Request) {
  // Mismo freno que el resto de las rutas: aquí se recorre la guía y se cruza
  // con la lista, y las dos cosas cuestan.
  if (excedeLimite(identificarCliente(request))) return respuestaLimite();

  const params = new URL(request.url).searchParams;

  /**
   * Los canales se piden **por nombre**, que es con lo que la guía sabe buscar
   * (`programasEnFranja` cruza por `tvg-id` y cae al nombre). Se responde en el
   * mismo orden en que se piden para que el cliente no tenga que reordenar.
   */
  const nombres = (params.get("canales") ?? "")
    .split("\n")
    .map((nombre) => nombre.trim())
    .filter(Boolean)
    .slice(0, MAX_CANALES);

  if (nombres.length === 0) {
    return Response.json({ error: "Falta la lista de canales" }, { status: 400 });
  }

  const desde = Number(params.get("desde"));
  if (!Number.isInteger(desde) || desde <= 0) {
    return Response.json({ error: "Falta un «desde» válido" }, { status: 400 });
  }

  const horas = Number(params.get("horas"));
  if (!Number.isInteger(horas) || horas <= 0 || horas > MAX_HORAS) {
    return Response.json({ error: "«horas» fuera de rango" }, { status: 400 });
  }
  const hasta = desde + horas * 60 * 60 * 1000;

  try {
    /**
     * La guía se elige igual que en `lista-canales.ts`, y con la misma
     * distinción de confianza: la de `EPG_URL` la puso quien despliega, la de
     * la lista la eligió quien controla esa lista. Ver `fetchEpg`.
     */
    const { epgUrl: epgDeLaLista } = await loadM3uPlaylist();
    const propia = serverConfig().epgUrl;
    const url = propia || epgDeLaLista || "";
    const guia = url ? await fetchEpg(url, !propia) : null;

    if (!guia) {
      /**
       * Sin guía configurada esto no es un error: es el caso por defecto de la
       * app. Se responde con la forma correcta y vacía para que el cliente
       * pinte una parrilla de huecos —que dice la verdad— en vez de un fallo.
       */
      return Response.json(
        { programas: nombres.map(() => [] as ProgramaTupla[]), hayGuia: false },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
      );
    }

    const programas: ProgramaTupla[][] = nombres.map((nombre) =>
      programasEnFranja(guia, "", nombre, desde, hasta).map(
        (p) => [p.start, p.stop, p.title] as ProgramaTupla,
      ),
    );

    return Response.json(
      { programas, hayGuia: true },
      {
        // Cinco minutos, igual que la lista: la guía en memoria dura diez y los
        // programas duran media hora larga. Nadie nota el desfase.
        headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
      },
    );
  } catch {
    return Response.json(
      { error: "guia-no-disponible" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
