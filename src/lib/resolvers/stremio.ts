import { serverConfig } from "@/lib/config";
import type { MediaType } from "@/lib/catalog/types";
import type { ServidorStream } from "./types";

/**
 * Fuentes directas vía addons de Stremio.
 *
 * Un addon de Stremio es una URL que, dada una película o un episodio en IMDB,
 * responde con enlaces de vídeo. Muchos sirven enlaces HTTP directos
 * (.mp4/.m3u8) alojados por ellos mismos: reproducidos en nuestro
 * `<video>` propio son la única experiencia SIN anuncios posible sin pagar
 * nada — el iFrame ajeno deja de existir.
 *
 * Se configura con `STREMIO_MANIFESTS` (separado por comas), p. ej.:
 *   STREMIO_MANIFESTS="https://v3-cinematastic.madewithharsh.workers.dev"
 * Sin esa variable este módulo no sale a la red y no cambia nada.
 *
 * OJO: se descartan las entradas tipo torrent (infohash) a propósito — un
 * navegador no puede reproducirlas y aquí nadie las convierte.
 */

const PLAZO_MS = 8000;
/** Tope de servidores añadidos: los addons pueden traer docenas por título. */
const MAX_SERVIDORES = 6;

interface StreamStremio {
  title?: string;
  description?: string | null;
  /** Enlace directo http(s); si viene `infoHash` es un torrent y se descarta. */
  url?: string;
  infoHash?: string | null;
}

interface RespuestaStremio {
  streams?: StreamStremio[];
}

function etiquetaDe(stream: StreamStremio, indice: number): string {
  // Los addons ponen «Addon\nTítulo\nCalidad» en el title: nos quedamos con
  // la línea más útil (la primera no vacía tras el nombre del addon).
  const lineas = `${stream.title ?? stream.description ?? ""}`
    .split("\n")
    .map((linea) => linea.trim())
    .filter(Boolean);
  const util = lineas.find((linea) => !/^direct\s*link$/i.test(linea)) ?? "Directo";
  const corta = util.length > 28 ? `${util.slice(0, 27)}…` : util;
  return lineas.length > 0 ? corta : `Directo ${indice + 1}`;
}

/**
 * Pide fuentes a cada manifiesto configurado, en paralelo.
 *
 * Devuelve servidores «video»: URLs directas que la ficha reproduce en su
 * propio reproductor. Fallos de red o respuestas raras devuelven lista vacía;
 * es un complemento opcional, nunca un requisito.
 */
/** ¿Hay manifiestos configurados? Evita trabajo y llamadas si no. */
export function stremioActivo(): boolean {
  return serverConfig().stremioManifestos.trim().length > 0;
}

export async function fuentesDirectas(
  tmdbId: number,
  type: MediaType,
  imdbId: string | null,
  temporada: number,
  episodio: number
): Promise<ServidorStream[]> {
  const manifiestos = serverConfig()
    .stremioManifestos.split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (manifiestos.length === 0 || !imdbId) return [];

  const imdb = imdbId.startsWith("tt") ? imdbId : `tt${imdbId}`;
  const ruta =
    type === "movie"
      ? `/stream/movie/${imdb}.json`
      : `/stream/series/${imdb}:${temporada}:${episodio}.json`;

  const respuestas = await Promise.allSettled(
    manifiestos.map(async (base) => {
      const response = await fetch(`${base}${ruta}`, {
        signal: AbortSignal.timeout(PLAZO_MS),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as RespuestaStremio;
    })
  );

  const vistas = new Set<string>();
  const servidores: ServidorStream[] = [];

  for (const resultado of respuestas) {
    if (resultado.status !== "fulfilled") continue;
    for (const stream of resultado.value.streams ?? []) {
      if (servidores.length >= MAX_SERVIDORES) return servidores;
      // Solo HTTP directo: los torrents (infoHash) no son reproducibles aquí.
      if (!stream.url || stream.infoHash || !/^https?:\/\//i.test(stream.url)) continue;
      if (/\.torrent($|\?)/i.test(stream.url)) continue;
      if (vistas.has(stream.url)) continue;
      vistas.add(stream.url);

      servidores.push({
        id: `directo-${servidores.length + 1}`,
        label: `Directo · ${etiquetaDe(stream, servidores.length)}`,
        url: stream.url,
        tipo: "video",
      });
    }
  }
  return servidores;
}
