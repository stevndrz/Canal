"use client";

import Link from "next/link";
import { GeneroPanel } from "./genero-panel";
import type { TmdbGenre } from "@/lib/catalog/tmdb";
import type { OrdenCatalogo } from "@/lib/catalog/discover";

/**
 * Filtros del catálogo: tipo y género.
 *
 * Cuatro paradas de foco en total: tres píldoras de tipo y una que abre el
 * panel de géneros. Los veintiún géneros estaban aquí sueltos, partidos en dos
 * líneas centradas, y con la cabecera entera eso pedía ~26 pulsaciones de
 * mando antes de llegar al contenido. Ver `genero-panel.tsx`.
 *
 * Todo sigue siendo navegación por enlaces (`?tipo=…&genero=…`), no estado de
 * cliente: se puede compartir, el botón atrás deshace y funciona sin
 * JavaScript.
 */
export type MediaFilter = "todo" | "movie" | "tv";

const TIPOS: { id: MediaFilter; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "movie", label: "Películas" },
  { id: "tv", label: "Series" },
];

/** Tipo y género en una sola línea centrada: cuatro píldoras y ya está. */
const FILA_TIPOS = "flex flex-wrap items-center justify-center gap-2 py-2 w-full";

/** Píldora activa/inactiva, con contraste suficiente para leerse a 3 metros. */
/**
 * La píldora de filtro, con la clase que ya existe.
 *
 * Antes se armaba aquí con utilidades sueltas, y salía distinta de la que usa
 * la lista de temporadas de una serie —la misma pieza, dos veces—. La de
 * `globals.css` además está pensada para un mando: 44px de alto mínimo en vez
 * de los ~34 que dejaba `py-1.5`, y tipografía que crece con la pantalla en
 * vez de 14px fijos en un televisor de 1920.
 */
function chip(activo: boolean): string {
  return `catalogo-chip ${activo ? "is-active" : ""}`;
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
      <div className={FILA_TIPOS} role="group" aria-label="Filtros del catálogo">
        {TIPOS.map(({ id, label }) => (
          <Link
            key={id}
            data-nav="button"
            href={href(id, genero, generosValidos, orden)}
            aria-current={tipo === id ? "true" : undefined}
            className={chip(tipo === id)}
          >
            {label}
          </Link>
        ))}

        {generos.length > 0 && (
          <GeneroPanel
            generos={generos}
            activo={genero}
            hrefDe={(id) => href(tipo, id, generosValidos, orden)}
          />
        )}
      </div>
    </div>
  );
}
