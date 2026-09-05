import { fetchEpg, programasEnFranja } from "@/lib/epg";
import { serverConfig } from "@/lib/config.server";
import { loadM3uPlaylist } from "@/lib/m3u";
import { normalizeChannelName } from "@/lib/text";
import { excedeLimite, identificarCliente, respuestaLimite } from "@/lib/limite-peticiones";

/**
 * La programación de unos pocos canales, para la parrilla.
 *
 * Hace falta una ruta porque la programación **no puede viajar con la lista**:
 * cada campo que se añada a `Channel` viaja 7.822 veces, y ya se retiraron
 * cuatro que sumaban 1,4 MB (ver `types.ts`). Una parrilla necesita decenas de
 * programas por canal donde hoy viajan dos.
 *
 * Así que se paga por lo que se mira: los canales en pantalla y la franja que
 * se está mirando. En tuplas, por lo mismo que `canales-empaquetados.ts`.
 */

/**
 * Además de un tope de trabajo es un tope de amplificación: sin él, esta ruta
 * hace que el servidor recorra la guía tantas veces como alguien quiera.
 */
const MAX_CANALES = 40;

/** Tope de franja pedida. Tres horas es lo que pinta la parrilla de una vez. */
const MAX_HORAS = 6;

/**
 * La respuesta se cachea en el borde con la URL entera por clave, así que un
 * `desde` sin tope son infinitas URLs que caducan sin que nadie las repita.
 * Mismo agujero que se cerró en `/api/stream` acotando el `tmdbId`.
 */
const MARGEN_MS = 7 * 24 * 60 * 60 * 1000;

/** Tope de nombre de canal. Los de verdad no pasan de 60 caracteres. */
const MAX_LARGO_NOMBRE = 120;

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
    .map((nombre) => nombre.trim().slice(0, MAX_LARGO_NOMBRE))
    .filter(Boolean)
    .slice(0, MAX_CANALES);

  if (nombres.length === 0) {
    return Response.json({ error: "Falta la lista de canales" }, { status: 400 });
  }

  const desde = Number(params.get("desde"));
  const ahora = Date.now();
  if (
    !Number.isInteger(desde) ||
    desde < ahora - MARGEN_MS ||
    desde > ahora + MARGEN_MS
  ) {
    return Response.json({ error: "Falta un «desde» válido" }, { status: 400 });
  }

  const horas = Number(params.get("horas"));
  if (!Number.isInteger(horas) || horas <= 0 || horas > MAX_HORAS) {
    return Response.json({ error: "«horas» fuera de rango" }, { status: 400 });
  }
  const hasta = desde + horas * 60 * 60 * 1000;

  try {
    // Misma distinción de confianza que en `lista-canales.ts`: la de `EPG_URL`
    // la puso quien despliega, la de la lista la eligió otro. Ver `fetchEpg`.
    const { channels, epgUrl: epgDeLaLista } = await loadM3uPlaylist();
    const propia = serverConfig().epgUrl;
    const url = propia || epgDeLaLista || "";
    const guia = url ? await fetchEpg(url, !propia) : null;

    if (!guia) {
      // Sin guía no es un error, es el caso por defecto: se responde con la
      // forma correcta y vacía para que la parrilla salga de huecos, que dice
      // la verdad, en vez de un fallo.
      return Response.json(
        { programas: nombres.map(() => [] as ProgramaTupla[]), hayGuia: false },
        { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
      );
    }

    // El cliente solo manda nombres —es lo único que conoce, ver el comentario
    // de arriba—, así que aquí se resuelve el `tvg-id` cruzando por nombre
    // contra la misma lista M3U que ya se cargó para `epgDeLaLista`. Activa el
    // emparejamiento exacto de `findProgrammes` en vez de caer siempre al
    // respaldo por nombre.
    const tvgIdPorNombre = new Map<string, string>();
    for (const canal of channels) {
      if (!canal.tvgId) continue;
      const clave = normalizeChannelName(canal.name);
      if (!tvgIdPorNombre.has(clave)) tvgIdPorNombre.set(clave, canal.tvgId);
    }

    const programas: ProgramaTupla[][] = nombres.map((nombre) => {
      const tvgId = tvgIdPorNombre.get(normalizeChannelName(nombre)) ?? "";
      return programasEnFranja(guia, tvgId, nombre, desde, hasta).map(
        (p) => [p.start, p.stop, p.title] as ProgramaTupla,
      );
    });

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
