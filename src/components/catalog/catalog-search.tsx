import { Search } from "lucide-react";

/**
 * Buscador del catálogo.
 *
 * Es un formulario de toda la vida, sin estado de cliente, a propósito:
 *  - funciona en los navegadores viejos de las TV, que es donde se va a usar;
 *  - la búsqueda queda en la URL (`?q=`), así que se puede compartir y el botón
 *    de atrás hace lo que uno espera;
 *  - no dispara una petición por tecla, que con el teclado en pantalla de un
 *    control remoto sería una por cada pulsación de flecha.
 */
export function CatalogSearch({ query }: { query: string }) {
  return (
    <form action="/peliculas" method="get" role="search" className="mb-6">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40"
        />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Buscar película o serie..."
          aria-label="Buscar películas y series"
          className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 pl-12 pr-28 text-base text-white shadow-sm placeholder-white/40 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400 sm:py-3.5"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow-md transition hover:from-violet-500 hover:to-purple-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}
