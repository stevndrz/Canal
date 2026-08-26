import { Suspense } from "react";
import { Clapperboard, Info, SearchX } from "lucide-react";
import { CatalogGrid, CatalogRows } from "@/components/catalog/catalog-row";
import { HeroDestacado } from "@/components/catalog/hero-destacado";
import { Paginador } from "@/components/catalog/paginador";
import { EstadoVacio } from "@/components/catalog/estado-vacio";
import { CatalogSearch } from "@/components/catalog/catalog-search";
import { NavegacionCatalogo } from "@/components/catalog/navegacion-catalogo";
import { CatalogFilters, type MediaFilter } from "@/components/catalog/catalog-filters";
import { TopNav } from "@/components/shell/top-nav";
import { EsqueletoCatalogo } from "@/components/esqueleto-catalogo";
import { getCatalogSections } from "@/lib/catalog/catalog";
import { fetchFiltered, type OrdenCatalogo } from "@/lib/catalog/discover";
import { fetchGenres, isTmdbConfigured } from "@/lib/catalog/tmdb";

/**
 * El catálogo es idéntico para todo el mundo: los filtros y la página van en
 * la URL, no en la sesión. Con `revalidate` Next guarda el resultado de cada
 * combinación de parámetros que ya haya visto, en lugar de repetir las diez
 * llamadas a TMDB en cada visita.
 *
 * Una hora: TMDB no cambia sus listas más rápido que eso, y `tmdb.ts` ya
 * cachea las peticiones sueltas un día.
 */
export const revalidate = 3600;

/** Lo que la URL trae, ya saneado antes de tocar TMDB. */
interface Filtro {
  q?: string;
  tipo?: string;
  genero?: string;
  pagina?: string;
  orden?: string;
}

/**
 * Todo el contenido bajo la barra: héroe, buscador, filtros y catálogo.
 *
 * Vive separado de la página para poder streamearse entero. Las doce
 * peticiones a TMDB que alimenta —diez filas del catálogo, dos listas de
 * géneros— tardan medio segundo en caliente y hasta tres o más en frío, y
 * antes bloqueaban el render COMPLETO de la ruta: pulsar «Cine y series» era
 * mirar un esqueleto todo ese tiempo sin barra ni nada que hacer. Ahora el
 * armazón llega en el primer fotograma y esto ocupa su lugar en cuanto hay
 * datos: la API lenta retrasa las carátulas, no el entrar.
 */
async function SeccionCatalogo({
  q,
  tipo: tipoParam,
  genero: generoParam,
  pagina: paginaParam,
  orden: ordenParam,
}: Filtro) {
  const query = q?.trim() ?? "";

  const tipo: MediaFilter = tipoParam === "movie" || tipoParam === "tv" ? tipoParam : "todo";
  const generoId = Number(generoParam);
  const genero = Number.isInteger(generoId) && generoId > 0 ? generoId : null;

  /**
   * Criterio de orden. «Populares» es el cero de la escala: con él la portada
   * muestra las filas curadas de siempre. Cualquier otro criterio —o un
   * filtro— cambia la vista a una cuadrilla servida por discover.
   */
  const orden: OrdenCatalogo =
    ordenParam === "top" || ordenParam === "recientes" ? ordenParam : "populares";
  const filtrando = tipo !== "todo" || genero !== null;
  const enCuadricula = filtrando || orden !== "populares";

  /**
   * La página pedida, acotada.
   *
   * Viene de la URL, o sea de fuera: `?pagina=-5` o `?pagina=abc` llegarían
   * tal cual a la consulta de TMDB, que respondería con un error y dejaría la
   * pantalla vacía sin explicación. 500 es el tope que sirve su API.
   */
  const pagina = Math.min(Math.max(Number(paginaParam) || 1, 1), 500);

  /** URL de otra página, conservando filtros y orden. */
  const enlacePagina = (n: number) => {
    const p = new URLSearchParams();
    if (tipo !== "todo") p.set("tipo", tipo);
    if (genero) p.set("genero", String(genero));
    if (orden !== "populares") p.set("orden", orden);
    if (n > 1) p.set("pagina", String(n));
    const cadena = p.toString();
    return cadena ? `/peliculas?${cadena}` : "/peliculas";
  };

  // Solo se pide lo que se va a pintar: en modo cuadrilla no hacen falta las
  // diez filas del catálogo, que son diez peticiones a TMDB. Las dos listas de
  // géneros sí siempre: no coinciden entre tipos (series no tiene Terror) y
  // alimentan tanto las píldoras como la validez del filtro aplicado.
  const [rows, generosPeli, generosSerie] = await Promise.all([
    enCuadricula ? Promise.resolve([]) : getCatalogSections(),
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
  const cuadricula = enCuadricula
    ? await fetchFiltered(tipo, genero, validos, pagina, orden)
    : null;
  const tmdbReady = isTmdbConfigured();

  /**
   * El héroe rota en cada visita: se elige al azar entre los diez primeros
   * títulos con arte apaisado de las filas. Mostrar siempre el mismo
   * convertía la cabecera en un mueble; el sorteo no cuesta ninguna petición
   * extra — los candidatos ya estaban en `rows`.
   *
   * Solo aparece en modo filas: en una cuadrilla la respuesta a lo pedido son
   * los resultados, y una cabecera de 70vh los empujaría fuera.
   */
  const candidatos = rows.flatMap((fila) => fila.items).filter((item) => item.backdrop).slice(0, 10);
  // eslint-disable-next-line react-hooks/purity -- RSC: corre una vez por request.
  const destacado = candidatos.length > 0 ? candidatos[Math.floor(Math.random() * candidatos.length)] : null;

  /** El contenido bajo el buscador: filas curadas o cuadrilla + paginación. */
  const contenido = cuadricula ? (
    cuadricula.items.length > 0 ? (
      <>
        <CatalogGrid items={cuadricula.items} />
        <Paginador pagina={cuadricula.pagina} totalPaginas={cuadricula.totalPaginas} href={enlacePagina} />
      </>
    ) : (
      <EstadoVacio
        Icono={SearchX}
        titulo="Nada con esos filtros"
        detalle="Prueba con otro género o cambia el tipo."
      />
    )
  ) : rows.length > 0 ? (
    <CatalogRows sections={rows} />
  ) : (
    <EstadoVacio
      Icono={Clapperboard}
      titulo="Tu catálogo está vacío"
      detalle={
        tmdbReady
          ? "TMDB no respondió desde el servidor: revisa la consola de `next dev` y tu conexión. Reintenta recargando."
          : "Añade títulos en src/data/catalog.json, o configura TMDB_API_KEY."
      }
    />
  );

  return (
    <>
      {destacado && <HeroDestacado item={destacado} />}

      {/* `has-hero` quita el hueco superior: la cabecera ya empieza pegada al
          borde y lo reserva ella. La caja centrada (max-w-7xl) vive dentro de
          CatalogSearch y contiene buscador, orden, píldoras y carruseles. */}
      <div className={`screen tv-safe ${destacado ? "has-hero" : ""}`}>
        {/* La búsqueda es reactiva en el cliente: mientras hay consulta,
            sustituye a estos hijos servidos por el servidor; al vaciar el
            campo, vuelven sin recargar nada. */}
        <CatalogSearch
          initialQuery={query}
          orden={orden}
          conHero={Boolean(destacado)}
          /* La página no tenía ningún título propio, y eso era parte de por
             qué se leía como «solo pelis»: lo único que la nombraba era la
             barra de arriba, que además decía «Películas». */
          titulo={
            <section className="section-heading catalogo-encabezado">
              <h2>Cine y series</h2>
            </section>
          }
        >
          {!tmdbReady && (
            <p className="catalogo-aviso">
              <Info aria-hidden="true" />
              <span>
                Falta <code>TMDB_API_KEY</code>: se ven solo los títulos escritos a mano en{" "}
                <code>src/data/catalog.json</code>.
              </span>
            </p>
          )}

          <CatalogFilters
            tipo={tipo}
            genero={genero}
            generos={generos}
            generosValidos={validos}
            orden={orden}
          />

          {contenido}
        </CatalogSearch>
      </div>
    </>
  );
}

export default async function MoviesPage({ searchParams }: { searchParams: Promise<Filtro> }) {
  // searchParams está disponible de inmediato: es lo primero que trae la
  // petición. Lo costoso —las listas de TMDB— queda confinado a
  // `SeccionCatalogo`, que se streamea debajo del `<Suspense>` mientras la
  // barra ya está en pantalla.
  const filtro = await searchParams;

  return (
    /* El mando: esta ruta vive fuera del shell, así que monta su propia
       navegación espacial. Ver `navegacion-catalogo.tsx`. */
    <NavegacionCatalogo>
      <div className="app-shell bg-black">
        <TopNav />

        {/* El fallback es el MISMO esqueleto que el del segmento
            (`loading.tsx`): a quien mira no le puede cambiar la pantalla dos
            veces por un redibujado del mismo dibujo. */}
        <Suspense fallback={<EsqueletoCatalogo />}>
          <SeccionCatalogo {...filtro} />
        </Suspense>
      </div>
    </NavegacionCatalogo>
  );
}
