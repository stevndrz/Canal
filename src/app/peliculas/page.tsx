import Link from "next/link";
import { Clapperboard, Info, SearchX } from "lucide-react";
import { CatalogGrid, CatalogRows } from "@/components/catalog/catalog-row";
import { CatalogSearch } from "@/components/catalog/catalog-search";
import { CatalogFilters, type MediaFilter } from "@/components/catalog/catalog-filters";
import { AppBar } from "@/components/app-bar";
import { getCatalogSections } from "@/lib/catalog/catalog";
import { fetchFiltered, searchCatalog } from "@/lib/catalog/discover";
import { fetchGenres, isTmdbConfigured } from "@/lib/catalog/tmdb";

export const dynamic = "force-dynamic";

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; genero?: string }>;
}) {
  const { q, tipo: tipoParam, genero: generoParam } = await searchParams;
  const query = q?.trim() ?? "";
  const searching = query.length > 0;

  const tipo: MediaFilter =
    tipoParam === "movie" || tipoParam === "tv" ? tipoParam : "todo";
  const generoId = Number(generoParam);
  const genero = Number.isInteger(generoId) && generoId > 0 ? generoId : null;
  const filtrando = !searching && (tipo !== "todo" || genero !== null);

  // Solo se pide lo que se va a pintar: buscando o filtrando no hacen falta las
  // diez filas del catálogo, que son diez peticiones a TMDB.
  // Las dos listas de géneros, porque no coinciden: series no tiene Terror y su
  // Acción es otro id. Se necesitan ambas para saber a qué tipo aplica el
  // género elegido y para pintar los botones correctos.
  const [rows, results, generosPeli, generosSerie] = await Promise.all([
    searching || filtrando ? Promise.resolve([]) : getCatalogSections(),
    searching ? searchCatalog(query) : Promise.resolve([]),
    fetchGenres("movie"),
    fetchGenres("tv"),
  ]);

  const validos = {
    movie: new Set(generosPeli.map((g) => g.id)),
    tv: new Set(generosSerie.map((g) => g.id)),
  };
  // Con "todo" se ofrecen los de películas, que es el conjunto más completo y
  // el que la gente reconoce; al pasar a Series se cambian por los suyos.
  const generos = tipo === "tv" ? generosSerie : generosPeli;
  const filtrados = filtrando ? await fetchFiltered(tipo, genero, validos) : [];
  const tmdbReady = isTmdbConfigured();

  return (
    // Fondo oscuro a propósito: es lo que se espera de una sección de cine y
    // además reduce el brillo en una TV grande de noche.
    <div className="min-h-screen bg-[#0b0f14] text-white">
      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6 md:px-8 md:py-6">
        {/* La misma barra que en Canales: antes esta sección repintaba su
            propio encabezado con mosaico degradado y título enorme, y cambiar
            de sección se sentía como saltar a otro sitio. */}
        <AppBar tone="dark">
          <CatalogSearch query={query} />
        </AppBar>

        {!tmdbReady && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="font-semibold">Falta la clave de TMDB</p>
              <p className="mt-1 text-amber-100/80">
                Se están mostrando solo los datos escritos en{" "}
                <code className="rounded bg-black/30 px-1">src/data/catalog.json</code>. Añade{" "}
                <code className="rounded bg-black/30 px-1">TMDB_API_KEY</code> en{" "}
                <code className="rounded bg-black/30 px-1">.env.local</code> para que los pósters y
                los episodios se rellenen solos.
              </p>
            </div>
          </div>
        )}

        {!searching && (
          <CatalogFilters tipo={tipo} genero={genero} generos={generos} generosValidos={validos} />
        )}

        {filtrando ? (
          filtrados.length > 0 ? (
            <CatalogGrid items={filtrados} />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
              <SearchX aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-white/40" />
              <p className="font-medium text-white/80">Nada con esos filtros</p>
              <p className="mt-1 text-sm text-white/50">Prueba con otro género o cambia el tipo.</p>
            </div>
          )
        ) : searching ? (
          results.length > 0 ? (
            <>
              <h2 className="mb-3 text-lg font-bold tracking-tight text-white sm:text-xl">
                Resultados para “{query}”
              </h2>
              <CatalogGrid items={results} />
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
              <SearchX aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-white/40" />
              <p className="font-medium text-white/80">Sin resultados para “{query}”</p>
              <p className="mt-1 text-sm text-white/50">
                Prueba con menos palabras, o con el título original.
              </p>
              <Link
                href="/peliculas"
                className="mt-4 inline-block rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white/80 transition hover:bg-white/10 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400"
              >
                Volver al catálogo
              </Link>
            </div>
          )
        ) : rows.length > 0 ? (
          <CatalogRows sections={rows} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
            <Clapperboard aria-hidden="true" className="mx-auto mb-3 h-10 w-10 text-white/40" />
            <p className="font-medium text-white/80">Tu catálogo está vacío</p>
            <p className="mt-1 text-sm text-white/50">
              Agrega títulos en <code className="rounded bg-black/30 px-1">src/data/catalog.json</code>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
