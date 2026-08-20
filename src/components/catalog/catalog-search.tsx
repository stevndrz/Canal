import { Search } from "lucide-react";

/**
 * Buscador del catálogo.
 *
 * Sigue siendo un formulario de toda la vida, sin estado de cliente, y por las
 * mismas razones de antes: funciona en los navegadores viejos de las TV, la
 * búsqueda queda en la URL (`?q=`) así que se puede compartir y el botón de
 * atrás hace lo que uno espera, y no dispara una petición por cada pulsación
 * del teclado en pantalla de un mando.
 *
 * Lo que cambia es la maqueta. El botón "Buscar" iba en `position: absolute`
 * encima del campo, y el campo reservaba hueco para él con un `padding-right`
 * fijo de 7rem. En un teléfono eso deja sitio para unos pocos caracteres antes
 * de que el texto se meta debajo del botón, y en pantallas grandes el campo se
 * estiraba de lado a lado hasta dejar de leerse como un campo.
 *
 * Ahora campo y botón son hermanos en una fila: cada uno ocupa lo suyo, nada se
 * solapa a ningún ancho, y el conjunto va centrado y acotado.
 */
export function CatalogSearch({ query }: { query: string }) {
  return (
    <form action="/peliculas" method="get" role="search" className="catalogo-buscador">
      <div className="catalogo-buscador-campo">
        <Search aria-hidden="true" />
        <input
          type="search"
          name="q"
          data-nav="input"
          defaultValue={query}
          placeholder="Buscar película o serie"
          aria-label="Buscar películas y series"
        />
      </div>
      {/* Con un mando no hay tecla Intro cómoda, así que el botón se queda. */}
      <button type="submit" data-nav="button" className="catalogo-buscador-enviar">
        Buscar
      </button>
    </form>
  );
}
