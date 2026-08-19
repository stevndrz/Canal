import Link from "next/link";
import type { TmdbGenre } from "@/lib/catalog/tmdb";

/**
 * Filtros del catálogo: tipo y género.
 *
 * Son enlaces y no controles con estado, por lo mismo que el buscador: en el
 * navegador de una televisión un `<Link>` se recorre con las flechas y se
 * activa con OK, sin depender de JavaScript, y el filtro queda en la URL —así
 * se comparte y el botón de atrás deshace el último cambio.
 */
export type MediaFilter = "todo" | "movie" | "tv";

const TIPOS: { id: MediaFilter; label: string }[] = [
  { id: "todo", label: "Todo" },
  { id: "movie", label: "Películas" },
  { id: "tv", label: "Series" },
];

function chip(activo: boolean): string {
  return `whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400 ${
    activo
      ? "bg-violet-600 text-white shadow-md"
      : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
  }`;
}

export interface GenerosValidos {
  movie: Set<number>;
  tv: Set<number>;
}

/**
 * Construye la URL conservando el otro filtro.
 *
 * Al cambiar de tipo se suelta el género si no existe en el tipo destino: las
 * listas de TMDB no coinciden (series no tiene Terror), y arrastrarlo dejaría
 * la rejilla vacía sin explicar por qué. Los que sí existen en ambos —Comedia,
 * Drama, Animación— se conservan.
 */
function href(
  tipo: MediaFilter,
  genero: number | null,
  validos?: GenerosValidos
): string {
  const params = new URLSearchParams();
  if (tipo !== "todo") params.set("tipo", tipo);

  const aplica =
    genero === null ||
    !validos ||
    (tipo === "todo" ? validos.movie.has(genero) || validos.tv.has(genero) : validos[tipo].has(genero));
  if (genero && aplica) params.set("genero", String(genero));

  const cadena = params.toString();
  return cadena ? `/peliculas?${cadena}` : "/peliculas";
}

export function CatalogFilters({
  tipo,
  genero,
  generos,
  generosValidos,
}: {
  tipo: MediaFilter;
  genero: number | null;
  generos: TmdbGenre[];
  generosValidos?: GenerosValidos;
}) {
  return (
    <div className="mb-5 space-y-2">
      <div className="flex gap-2" role="group" aria-label="Tipo de contenido">
        {TIPOS.map(({ id, label }) => (
          <Link key={id} href={href(id, genero, generosValidos)} aria-current={tipo === id ? "true" : undefined} className={chip(tipo === id)}>
            {label}
          </Link>
        ))}
      </div>

      {generos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" role="group" aria-label="Género">
          <Link href={href(tipo, null)} aria-current={genero === null ? "true" : undefined} className={chip(genero === null)}>
            Todos los géneros
          </Link>
          {generos.map((g) => (
            <Link
              key={g.id}
              href={href(tipo, g.id)}
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
