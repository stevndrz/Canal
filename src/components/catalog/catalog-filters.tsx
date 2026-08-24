"use client";

import Link from "next/link";
import type { TmdbGenre } from "@/lib/catalog/tmdb";
import type { OrdenCatalogo } from "@/lib/catalog/discover";

/**
 * Filtros del catálogo: tipo y género.
 *
 * Los géneros van en un carrusel horizontal deslizable —son más de los que
 * caben en una línea y el scroll horizontal de una fila de píldoras es un
 * patrón que cualquier usuario de Netflix ya tiene en la mano—. Sigue siendo
 * navegación por enlaces (`?tipo=…&genero=…`), no estado de cliente: se puede
 * compartir, el botón atrás deshace y funciona sin JavaScript.
 */
export type MediaFilter = "todo" | "movie" | "tv";

const TIPOS: { id: MediaFilter; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "movie", label: "Películas" },
  { id: "tv", label: "Series" },
];

/** Carrusel de píldoras: ocupa el ancho del contenedor, scrollea de lado y
    esconde la barra del navegador; las píldoras nunca se parten en dos líneas. */
const CARRUSEL =
  "flex items-center gap-2 overflow-x-auto whitespace-nowrap py-2 w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

/** Píldora activa/inactiva, con contraste suficiente para leerse a 3 metros. */
function chip(activo: boolean): string {
  const base = "inline-block shrink-0 rounded-full px-4 py-1.5 text-sm";
  return (
    base +
    (activo
      ? " bg-white text-black font-semibold shadow-md"
      : " bg-neutral-800/80 text-neutral-300 hover:bg-neutral-700 hover:text-white transition")
  );
}

export interface GenerosValidos {
  movie: Set<number>;
  tv: Set<number>;
}

/**
 * Construye la URL conservando el otro filtro (y el orden activo).
 *
 * Al cambiar de tipo se suelta el género si no existe en el tipo destino: las
 * listas de TMDB no coinciden (series no tiene Terror), y arrastrarlo dejaría
 * la rejilla vacía sin explicar por qué.
 */
function href(
  tipo: MediaFilter,
  genero: number | null,
  validos: GenerosValidos | undefined,
  orden: OrdenCatalogo
): string {
  const params = new URLSearchParams();
  if (tipo !== "todo") params.set("tipo", tipo);

  const aplica =
    genero === null ||
    !validos ||
    (tipo === "todo" ? validos.movie.has(genero) || validos.tv.has(genero) : validos[tipo].has(genero));
  if (genero && aplica) params.set("genero", String(genero));
  if (orden !== "populares") params.set("orden", orden);

  const cadena = params.toString();
  return cadena ? `/peliculas?${cadena}` : "/peliculas";
}

export function CatalogFilters({
  tipo,
  genero,
  generos,
  generosValidos,
  orden = "populares",
}: {
  tipo: MediaFilter;
  genero: number | null;
  generos: TmdbGenre[];
  generosValidos?: GenerosValidos;
  /** Se conserva en los enlaces para que cambiar de género no resetee el orden. */
  orden?: OrdenCatalogo;
}) {
  return (
    <div className="w-full">
      <div className={CARRUSEL} role="group" aria-label="Tipo de contenido">
        {TIPOS.map(({ id, label }) => (
          <Link key={id} href={href(id, genero, generosValidos, orden)} aria-current={tipo === id ? "true" : undefined} className={chip(tipo === id)}>
            {label}
          </Link>
        ))}
      </div>

      {generos.length > 0 && (
        <div className={CARRUSEL} role="group" aria-label="Género">
          <Link href={href(tipo, null, generosValidos, orden)} aria-current={genero === null ? "true" : undefined} className={chip(genero === null)}>
            Todos los géneros
          </Link>
          {generos.map((g) => (
            <Link
              key={g.id}
              href={href(tipo, g.id, generosValidos, orden)}
              aria-current={genero === g.id ? "true" : undefined}
              className={chip(genero === g.id)}
            >
              {g.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
