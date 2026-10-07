import { Suspense } from "react";
import { Clapperboard, SearchX, WifiOff } from "lucide-react";
import { CatalogGrid } from "@/components/catalog/catalog-row";
import { CatalogRowsPersonalizadas } from "@/components/catalog/catalog-rows-personalizadas";
import { HeroDestacado } from "@/components/catalog/hero-destacado";
import { Paginador } from "@/components/catalog/paginador";
import { EstadoVacio } from "@/components/catalog/estado-vacio";
import { CatalogSearch } from "@/components/catalog/catalog-search";
import { NavegacionCatalogo } from "@/components/catalog/navegacion-catalogo";
import { CatalogFilters, type MediaFilter } from "@/components/catalog/catalog-filters";
import { PortadaBienvenida } from "@/components/catalog/portada-bienvenida";
import { TopNav } from "@/components/shell/top-nav";
import { EsqueletoCatalogo } from "@/components/esqueleto-catalogo";
import { catalogToCard } from "@/lib/media-item";
import { getCatalogo } from "@/lib/catalog/catalog";
import { fetchFiltered, type OrdenCatalogo } from "@/lib/catalog/discover";
import { fetchGenres, fetchTrailer, isTmdbConfigured } from "@/lib/catalog/tmdb";
import type { EstadoCatalogo } from "@/lib/catalog/estado";
import { GENERO_TERROR } from "@/lib/catalog/generos";
import type { CatalogSection } from "@/lib/catalog/types";

/**
 * El catálogo es idéntico para todo el mundo: los filtros y la página van en
 * la URL, no en la sesión.
 *
 * Antes había aquí un `revalidate = 3600`; bajo `cacheComponents` lo sustituye
 * el `cacheLife` que vive en `tmdb.ts`, junto a los datos: días si TMDB
 * contestó, minutos si falló (un tropiezo no puede dejar la sección vacía un
 * día entero).
 */

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
 * La promesa de `searchParams` cruza el límite del Suspense SIN esperarse en
 * la raíz de la página — ese detalle es exactamente lo que permite prerender
 * el armazón (barra incluida) en build y servirlo al instante; la API
 * dinámica se consume aquí dentro, cuando ya hay pantalla detrás. Las doce
 * peticiones a TMDB que esto alimenta tardan medio segundo en caliente y
 * hasta tres o más en frío, y antes bloqueaban el render COMPLETO de la ruta:
 * pulsar «Cine y series» era mirar un esqueleto todo ese tiempo sin barra ni
 * nada que hacer. Ahora la barra está arriba desde el primer fotograma y esto
 * ocupa su lugar en cuanto hay datos: la API lenta retrasa las carátulas, no
 * el entrar.
 */
async function SeccionCatalogo({ filtro }: { filtro: Promise<Filtro> }) {
  const { q, tipo: tipoParam, genero: generoParam, pagina: paginaParam, orden: ordenParam } =
    await filtro;
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

  /**
   * Con `?q=` en la URL (un enlace compartido, o Enter en el buscador) lo que
   * se pinta son los resultados, que pide el cliente. Las diez filas y el
   * héroe no se verían —el buscador los recoge—, así que no se piden: son
   * once viajes a TMDB para nada.
   */
  const conConsulta = query.length >= 2;

  // Solo se pide lo que se va a pintar: en modo cuadrilla no hacen falta las
  // diez filas del catálogo, que son diez peticiones a TMDB. Las dos listas de
  // géneros sí siempre: no coinciden entre tipos (series no tiene Terror) y
  // alimentan tanto las píldoras como la validez del filtro aplicado.
  const [catalogo, generosPeli, generosSerie] = await Promise.all([
    enCuadricula || conConsulta ? null : getCatalogo(),
    fetchGenres("movie"),
    fetchGenres("tv"),
  ]);
  const rows: CatalogSection[] = catalogo?.filas ?? [];

  const validos = {
    movie: new Set(generosPeli.map((g) => g.id)),
    tv: new Set(generosSerie.map((g) => g.id)),
  };
  // Con "todo" se ofrecen los de películas, que es el conjunto más completo y
  // el que la gente reconoce; al pasar a Series se cambian por los suyos.
  const generos = tipo === "tv" ? generosSerie : generosPeli;
  const cuadricula = enCuadricula && !conConsulta
    ? await fetchFiltered(tipo, genero, validos, pagina, orden)
    : null;
  const configurado = isTmdbConfigured();

  /**
   * El estado de la pantalla, en una palabra. Ver `lib/catalog/estado.ts`:
   * «no hay clave», «TMDB no contesta» y «este filtro no tiene títulos» son
   * tres cosas distintas y antes se pintaban igual.
   */
  const estado: EstadoCatalogo = catalogo
    ? catalogo.estado
    : !configurado
      ? "sin-configurar"
      : cuadricula?.fallo
        ? "no-disponible"
        : "listo";

  /**
   * Sin catálogo: la portada de bienvenida, y nada de buscador, orden,
   * píldoras ni paginador, que no llevarían a ninguna parte. «Seguir viendo»
   * y «Mi lista» sí se quedan: viven en este aparato y no dependen de TMDB.
   */
  if (estado !== "listo") {
    return (
      <>
        <PortadaBienvenida estado={estado} aviso={<AvisoTecnico estado={estado} />} />
        <div className="screen sin-hueco tv-safe">
          <CatalogRowsPersonalizadas filas={[]} />
        </div>
      </>
    );
  }

  /**
   * El héroe rota en cada visita: se elige al azar entre los diez primeros
   * títulos con arte apaisado de las filas. Mostrar siempre el mismo
   * convertía la cabecera en un mueble; el sorteo no cuesta ninguna petición
   * extra — los candidatos ya estaban en `rows`.
   *
   * Nunca uno de terror: es lo primero que se ve al entrar, y en casa entra
   * todo el mundo. El terror sigue en su fila y en su género.
   *
   * Solo aparece en modo filas: en una cuadrilla la respuesta a lo pedido son
   * los resultados, y una cabecera de 70vh los empujaría fuera.
   */
  const candidatos = rows
    .flatMap((fila) => fila.items)
    .filter((item) => item.backdrop && !item.generoIds?.includes(GENERO_TERROR))
    .slice(0, 10);
  // eslint-disable-next-line react-hooks/purity -- RSC: corre una vez por request.
  const destacado = candidatos.length > 0 ? candidatos[Math.floor(Math.random() * candidatos.length)] : null;

  /**
   * El tráiler del héroe, en una petición aparte.
   *
   * `destacado` sale de `fetchCatalogRows()`, que no pide vídeos —costaría una
   * petición por cada título de cada fila, veinte de sobra para lo que se
   * pinta—. Aquí ya se eligió a UNO solo, así que una petición extra es
   * barata, y `tmdbConClave` la deja cacheada un día igual que el resto.
   */
  const heroTrailer =
    destacado?.tmdbId != null ? await fetchTrailer(destacado.tmdbId, destacado.mediaType) : null;

  /** El contenido bajo la cabecera: filas curadas o cuadrilla + paginación. */
  const contenido = cuadricula ? (
    cuadricula.items.length > 0 ? (
      <>
        {/* La conversión a tarjeta ocurre AQUÍ, en el servidor, y no dentro de
            `CatalogGrid`, que es de cliente: así cruza la red lo que se pinta y
            no la ficha entera de TMDB. Ver `CatalogRows`. */}
        <CatalogGrid tarjetas={cuadricula.items.map(catalogToCard)} />
        <Paginador pagina={cuadricula.pagina} totalPaginas={cuadricula.totalPaginas} href={enlacePagina} />
      </>
    ) : (
      <EstadoVacio
        Icono={SearchX}
        titulo="No hay títulos con estos filtros"
        detalle="Prueba con otro género o con «Todo»."
        accion={{ href: "/peliculas", texto: "Ver todo el catálogo" }}
      />
    )
  ) : conConsulta ? null : (
    <CatalogRowsPersonalizadas
      filas={rows.map((fila) => ({
        title: fila.title,
        href: fila.href,
        tarjetas: fila.items.map(catalogToCard),
      }))}
    />
  );

  return (
    <CatalogSearch
      initialQuery={query}
      orden={orden}
      cabecera={destacado ? <HeroDestacado item={destacado} trailerUrl={heroTrailer} /> : null}
      /* La página no tenía ningún título propio, y eso era parte de por qué se
         leía como «solo pelis»: lo único que la nombraba era la barra de
         arriba, que además decía «Películas». */
      titulo={<h2 className="catalogo-titulo">Cine y series</h2>}
      filtros={
        <CatalogFilters
          tipo={tipo}
          genero={genero}
          generos={generos}
          generosValidos={validos}
          orden={orden}
        />
      }
    >
      {contenido}
    </CatalogSearch>
  );
}

/**
 * La pista técnica para quien desarrolla, y SOLO en desarrollo.
 *
 * En producción la ve la familia, y «Falta TMDB_API_KEY» no le sirve de nada:
 * ahí el dato va al registro del servidor (`getCatalogo` hace el
 * `console.error`). Aquí, en `next dev`, sigue siendo la forma más rápida de
 * saber por qué el catálogo sale vacío.
 */
function AvisoTecnico({ estado }: { estado: Exclude<EstadoCatalogo, "listo"> }) {
  if (process.env.NODE_ENV === "production") return null;
  const Icono = estado === "sin-configurar" ? Clapperboard : WifiOff;
  return (
    <p className="catalogo-aviso">
      <Icono aria-hidden="true" />
      <span>
        Solo en desarrollo:{" "}
        {estado === "sin-configurar" ? (
          <>
            falta <code>TMDB_API_KEY</code> (o títulos en <code>src/data/catalog.json</code>).
          </>
        ) : (
          <>TMDB no respondió desde el servidor: mira la consola de <code>next dev</code>.</>
        )}
      </span>
    </p>
  );
}

export default async function MoviesPage({ searchParams }: { searchParams: Promise<Filtro> }) {
  // La promesa NO se espera aquí: `searchParams` es una API dinámica y
  // consumirla en la raíz convertiría TODO el armazón —la barra que da el
  // «instantáneo» al clic— en algo servible solo tras un render completo.
  // La recibe `SeccionCatalogo`, que vive debajo del `<Suspense>`.
  return (
    /* El mando: esta ruta vive fuera del shell, así que monta su propia
       navegación espacial. Ver `navegacion-catalogo.tsx`. */
    <NavegacionCatalogo>
      {/* Sin `bg-black`: el fondo es el de la app (el halo de `.app-shell`),
          y el héroe se disuelve en él. Con negro puro debajo, el velo del
          héroe —que acaba en el color de fondo de la app— dejaba una línea
          recta donde se juntaban los dos negros. */}
      <div className="app-shell">
        <TopNav />

        {/* El fallback es el MISMO esqueleto que el del segmento
            (`loading.tsx`): a quien mira no le puede cambiar la pantalla dos
            veces por un redibujado del mismo dibujo. */}
        <Suspense fallback={<EsqueletoCatalogo />}>
          <SeccionCatalogo filtro={searchParams} />
        </Suspense>
      </div>
    </NavegacionCatalogo>
  );
}
