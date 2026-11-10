import type { SubtitleTrack } from "@/lib/catalog/types";

/**
 * «Nuestras películas»: lo que hay subido a R2 para ver juntos.
 *
 * El archivo lo escribe `scripts/peliculas/subir-pelicula.ps1` en
 * `peliculas/catalogo.json` del bucket, y lo lee cada aparato al abrir Mi
 * enlace. Así subir una película es un paso y no dos: no hay que pegar el
 * enlace en cada aparato, ni los subtítulos, que Mi enlace no sabría recibir.
 *
 * Viene de fuera de la app, así que se lee con desconfianza: lo que no tenga
 * la forma esperada se descarta entero, y solo pasan URLs http(s), porque
 * acaban en el `src` de un `<video>` y de un `<track>`.
 */

export interface PeliculaNuestra {
  id: string;
  titulo: string;
  /** El `master.m3u8`. */
  url: string;
  subtitulos: SubtitleTrack[];
  /** En segundos, si se sabe. */
  duracion?: number;
  /** Cuándo se subió (ms), si el catálogo lo dice: para la etiqueta «Nueva». */
  subida?: number;
}

export function rutaCatalogo(base: string): string {
  return `${base}/peliculas/catalogo.json`;
}

const esHttp = (valor: unknown): valor is string => typeof valor === "string" && /^https?:\/\//i.test(valor);
const texto = (valor: unknown, tope: number): string => (typeof valor === "string" ? valor.trim().slice(0, tope) : "");

/**
 * Una lista, aunque venga como objeto suelto: `ConvertTo-Json` de PowerShell
 * 5.1 escribe a veces la lista de un solo elemento sin corchetes, y con eso una
 * película con un subtítulo —o un catálogo con una película— saldría vacío.
 */
function comoLista(crudo: unknown): unknown[] {
  if (Array.isArray(crudo)) return crudo;
  return crudo && typeof crudo === "object" ? [crudo] : [];
}

export function leerSubtitulos(crudo: unknown): SubtitleTrack[] {
  const pistas: SubtitleTrack[] = [];
  for (const s of comoLista(crudo).slice(0, 20)) {
    if (!s || typeof s !== "object") continue;
    const pista = s as Record<string, unknown>;
    // Además de http(s), que sea un .vtt: la primera subida real dejó una pista
    // con `label: null` que apuntaba a la carpeta de la película (un fallo del
    // script ya corregido). Ese 404 salía en el selector como «Subtítulos».
    if (!esHttp(pista.url) || !/\.vtt(?:[?#]|$)/i.test(pista.url)) continue;
    pistas.push({
      url: pista.url,
      label: texto(pista.label, 60) || "Subtítulos",
      srclang: texto(pista.srclang, 12) || "und",
    });
  }
  return pistas;
}

export function leerCatalogo(crudo: unknown): PeliculaNuestra[] {
  if (!crudo || typeof crudo !== "object") return [];
  const lista = comoLista((crudo as { peliculas?: unknown }).peliculas);

  const peliculas: PeliculaNuestra[] = [];
  const vistos = new Set<string>();
  for (const p of lista.slice(0, 200)) {
    if (!p || typeof p !== "object") continue;
    const entrada = p as Record<string, unknown>;
    const id = texto(entrada.id, 120);
    if (!id || vistos.has(id) || !esHttp(entrada.url)) continue;
    vistos.add(id);
    const duracion = typeof entrada.duracion === "number" && entrada.duracion > 0 ? entrada.duracion : undefined;
    const subida = typeof entrada.subida === "string" ? Date.parse(entrada.subida) : NaN;
    peliculas.push({
      id,
      titulo: texto(entrada.titulo, 200) || id,
      url: entrada.url,
      subtitulos: leerSubtitulos(entrada.subtitulos),
      duracion,
      ...(Number.isFinite(subida) ? { subida } : {}),
    });
  }
  return peliculas;
}
