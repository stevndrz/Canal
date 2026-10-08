"use client";

import Link from "next/link";
import { GeneroPanel } from "./genero-panel";
import type { TmdbGenre } from "@/lib/catalog/tmdb";
import type { OrdenCatalogo } from "@/lib/catalog/discover";

/**
 * Filtros del catálogo: tipo y género.
 *
 * Cuatro paradas de foco como mucho: tres píldoras de tipo (solo en Anime)
 * y una que abre el panel de géneros. Los veintiún géneros estaban aquí
 * sueltos, partidos en dos líneas centradas, y con la cabecera entera eso
 * pedía ~26 pulsaciones de mando antes de llegar al contenido. Ver `genero-panel.tsx`.
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
  base: string,
  /** Si el tipo va en la URL: solo en Anime. En las otras lo fija la ruta. */
  conTipos: boolean,
  tipo: MediaFilter,
  genero: number | null,
  validos: GenerosValidos | undefined,
  orden: OrdenCatalogo,
  plataforma: number | null = null
): string {
  const params = new URLSearchParams();
  if (conTipos && tipo !== "todo") params.set("tipo", tipo);

  const aplica =
    genero === null ||
    !validos ||
    (tipo === "todo" ? validos.movie.has(genero) || validos.tv.has(genero) : validos[tipo].has(genero));
  if (genero && aplica) params.set("genero", String(genero));
  if (orden !== "populares") params.set("orden", orden);
  if (plataforma) params.set("plataforma", String(plataforma));

  const cadena = params.toString();
  return cadena ? `${base}?${cadena}` : base;
}

export function CatalogFilters({
  base,
  conTipos,
  tipo,
  genero,
  generos,
  generosValidos,
  orden = "populares",
  plataforma = null,
}: {
  /** La ruta de la sección: `/peliculas`, `/series` o `/anime`. */
  base: string;
  /**
   * Las píldoras Todo/Películas/Series. Solo en Anime, que trae las dos
   * cosas: en Películas y en Series el tipo ya lo dice la sección.
   */
  conTipos: boolean;
  tipo: MediaFilter;
  genero: number | null;
  generos: TmdbGenre[];
  generosValidos?: GenerosValidos;
  /** Se conserva en los enlaces para que cambiar de género no resetee el orden. */
  orden?: OrdenCatalogo;
  /** Netflix, Prime Video…: también se conserva al cambiar de tipo o género. */
  plataforma?: number | null;
}) {
  /* Una fila a la izquierda, en el mismo margen que el héroe y los rieles.
     Centrada quedaba como una isla en mitad de la pantalla y, con el mando,
     bajar desde el héroe caía donde quisiera la geometría. */
  return (
    <div className="catalogo-pildoras" role="group" aria-label="Filtros del catálogo">
      {conTipos && TIPOS.map(({ id, label }) => (
        <Link
          key={id}
          data-nav="button"
          href={href(base, conTipos, id, genero, generosValidos, orden, plataforma)}
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
          hrefDe={(id) => href(base, conTipos, tipo, id, generosValidos, orden, plataforma)}
        />
      )}
    </div>
  );
}
