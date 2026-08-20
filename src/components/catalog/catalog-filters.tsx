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

/**
 * Los chips comparten el lenguaje del resto de la app.
 *
 * Antes eran morados —herencia del diseño anterior de esta sección— y eran lo
 * único morado en toda la aplicación: cambiar de Canales a Películas se notaba
 * como un salto a otro producto. El estilo vive en `globals.css`, junto al
 * resto, y no repartido en clases sueltas aquí.
 */
function chip(activo: boolean): string {
  return `catalogo-chip ${activo ? "is-active" : ""}`;
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
    <div className="mb-2">
      <div className="catalogo-filtros" role="group" aria-label="Tipo de contenido">
        {TIPOS.map(({ id, label }) => (
          <Link key={id} href={href(id, genero, generosValidos)} aria-current={tipo === id ? "true" : undefined} className={chip(tipo === id)}>
            {label}
          </Link>
        ))}
      </div>

      {generos.length > 0 && (
        <div className="catalogo-filtros" role="group" aria-label="Género">
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
