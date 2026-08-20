import { Clapperboard, Info, SearchX } from "lucide-react";
import { CatalogGrid, CatalogRows } from "@/components/catalog/catalog-row";
import { HeroDestacado } from "@/components/catalog/hero-destacado";
import { EstadoVacio } from "@/components/catalog/estado-vacio";
import { CatalogSearch } from "@/components/catalog/catalog-search";
import { CatalogFilters, type MediaFilter } from "@/components/catalog/catalog-filters";
import { TopNav } from "@/components/shell/top-nav";
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

  /**
   * El título del hero: el primero de la primera fila **que tenga arte
   * apaisado**. Sin esa condición salía el primero a secas y, cuando le
   * faltaba el backdrop, la cabecera quedaba en un rectángulo negro con texto
   * encima. Buscar uno con arte cuesta nada y no falla nunca.
   *
   * Solo aparece en el catálogo, no al buscar ni al filtrar: ahí la respuesta
   * a lo que se ha pedido son los resultados, y una cabecera de 78vh de otra
   * película los empujaría fuera de la pantalla.
   */
  const destacado = rows.flatMap((fila) => fila.items).find((item) => item.backdrop) ?? null;

  return (
    // `.app-shell` y `.screen`, las mismas piezas que usa el resto de la
    // aplicación. Esta ruta vive fuera del App Shell —conserva sus URLs por
    // título— pero eso no tiene por qué notarse: antes pintaba su propio fondo
    // y su propia barra, y al entrar aquí la navegación desaparecía.
    <div className="app-shell">
      <TopNav />

      {destacado && <HeroDestacado item={destacado} />}

      {/* `has-hero` quita el hueco superior: la cabecera ya empieza pegada al
          borde y lo reserva ella. */}
      <div className={`screen tv-safe ${destacado ? "has-hero" : ""}`}>
        <CatalogSearch query={query} />

        {!tmdbReady && (
          <p className="catalogo-aviso">
            <Info aria-hidden="true" />
            <span>
              Falta <code>TMDB_API_KEY</code>: se ven solo los títulos escritos a mano en{" "}
              <code>src/data/catalog.json</code>.
            </span>
          </p>
        )}

        {!searching && (
          <CatalogFilters tipo={tipo} genero={genero} generos={generos} generosValidos={validos} />
        )}

        {filtrando ? (
          filtrados.length > 0 ? (
            <CatalogGrid items={filtrados} />
          ) : (
            <EstadoVacio
              Icono={SearchX}
              titulo="Nada con esos filtros"
              detalle="Prueba con otro género o cambia el tipo."
            />
          )
        ) : searching ? (
          results.length > 0 ? (
            <>
              <section className="section-heading">
                <h2>Resultados para «{query}»</h2>
              </section>
              <CatalogGrid items={results} />
            </>
          ) : (
            <EstadoVacio
              Icono={SearchX}
              titulo={`Sin resultados para «${query}»`}
              detalle="Prueba con menos palabras, o con el título original."
              accion={{ href: "/peliculas", texto: "Volver al catálogo" }}
            />
          )
        ) : rows.length > 0 ? (
          <CatalogRows sections={rows} />
        ) : (
          <EstadoVacio
            Icono={Clapperboard}
            titulo="Tu catálogo está vacío"
            detalle="Añade títulos en src/data/catalog.json, o configura TMDB_API_KEY."
          />
        )}
      </div>
    </div>
  );
}
