import { redirect } from "next/navigation";
import { Clapperboard, SearchX, WifiOff } from "lucide-react";
import { CatalogGrid } from "@/components/catalog/catalog-row";
import { CatalogRowsPersonalizadas } from "@/components/catalog/catalog-rows-personalizadas";
import { Paginador } from "@/components/catalog/paginador";
import { EstadoVacio } from "@/components/catalog/estado-vacio";
import { CatalogSearch } from "@/components/catalog/catalog-search";
import { CatalogFilters, type MediaFilter } from "@/components/catalog/catalog-filters";
import { PortadaBienvenida } from "@/components/catalog/portada-bienvenida";
import { catalogToCard } from "@/lib/media-item";
import { getCatalogo } from "@/lib/catalog/catalog";
import { fetchFiltered, type OrdenCatalogo } from "@/lib/catalog/discover";
import { fetchGenres, fetchLogo, fetchPlataformas, fetchTrailer, isTmdbConfigured } from "@/lib/catalog/tmdb";
import { plataformaValida } from "@/lib/catalog/plataformas";
import { FilaPlataformas } from "@/components/catalog/fila-plataformas";
import { HeroCarrusel } from "@/components/catalog/hero-carrusel";
import type { EstadoCatalogo } from "@/lib/catalog/estado";
import { GENERO_TERROR } from "@/lib/catalog/generos";
import type { CatalogSection } from "@/lib/catalog/types";
import { ANIMACION, SECCIONES, type SeccionCatalogo as IdSeccion } from "@/lib/catalog/secciones";

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
export interface Filtro {
  q?: string;
  tipo?: string;
  genero?: string;
  pagina?: string;
  orden?: string;
  plataforma?: string;
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
export async function SeccionCatalogo({
  seccion: idSeccion,
  filtro,
}: {
  seccion: IdSeccion;
  filtro: Promise<Filtro>;
}) {
  const seccion = SECCIONES[idSeccion];
  const base = seccion.ruta;
  const {
    q,
    tipo: tipoParam,
    genero: generoParam,
    pagina: paginaParam,
    orden: ordenParam,
    plataforma: plataformaParam,
  } = await filtro;
  const query = q?.trim() ?? "";

  /**
   * Los enlaces de antes (`/peliculas?tipo=tv`, la portada, un marcador)
   * llevaban a las series por la URL de películas. Ahora tienen su sección:
   * se les manda allí con el resto de filtros intactos.
   */
  if (idSeccion === "peliculas" && tipoParam === "tv") {
    const resto = new URLSearchParams(
      Object.entries({ q, genero: generoParam, pagina: paginaParam, orden: ordenParam, plataforma: plataformaParam })
        .filter((par): par is [string, string] => Boolean(par[1])),
    ).toString();
    redirect(resto ? `${SECCIONES.series.ruta}?${resto}` : SECCIONES.series.ruta);
  }

  const tipo: MediaFilter =
    seccion.tipoFijo ?? (tipoParam === "movie" || tipoParam === "tv" ? tipoParam : "todo");
  const anime = idSeccion === "anime";
  const generoId = Number(generoParam);
  const genero = Number.isInteger(generoId) && generoId > 0 ? generoId : null;

  /**
   * Criterio de orden. «Populares» es el cero de la escala: con él la portada
   * muestra las filas curadas de siempre. Cualquier otro criterio —o un
   * filtro— cambia la vista a una cuadrilla servida por discover.
   */
  const orden: OrdenCatalogo =
    ordenParam === "top" || ordenParam === "recientes" ? ordenParam : "populares";
  /** Netflix, Prime Video… Solo ids de la lista cerrada: ver `plataformas.ts`. */
  const plataforma = plataformaValida(plataformaParam);
  // En Películas y Series el tipo viene dado: no es un filtro.
  const filtrando = (!seccion.tipoFijo && tipo !== "todo") || genero !== null || plataforma !== null;
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
    if (!seccion.tipoFijo && tipo !== "todo") p.set("tipo", tipo);
    if (genero) p.set("genero", String(genero));
    if (orden !== "populares") p.set("orden", orden);
    if (plataforma) p.set("plataforma", String(plataforma));
    if (n > 1) p.set("pagina", String(n));
    const cadena = p.toString();
    return cadena ? `${base}?${cadena}` : base;
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
  const [catalogo, generosPeli, generosSerie, plataformas] = await Promise.all([
    enCuadricula || conConsulta ? null : getCatalogo(idSeccion),
    fetchGenres("movie"),
    fetchGenres("tv"),
    conConsulta ? [] : fetchPlataformas(),
  ]);
  const rows: CatalogSection[] = catalogo?.filas ?? [];

  const validos = {
    movie: new Set(generosPeli.map((g) => g.id)),
    tv: new Set(generosSerie.map((g) => g.id)),
  };
  // Con "todo" se ofrecen los de películas, que es el conjunto más completo y
  // el que la gente reconoce; al pasar a Series se cambian por los suyos. En
  // Anime, «todo» es casi siempre series: se ofrecen los de series, y sin
  // Animación, que ahí es redundante.
  const generos = (tipo === "tv" || (anime && tipo === "todo") ? generosSerie : generosPeli).filter(
    (g) => !anime || g.id !== ANIMACION,
  );
  const cuadricula = enCuadricula && !conConsulta
    ? await fetchFiltered(tipo, genero, validos, pagina, orden, plataforma, anime)
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
   * Los destacados del héroe: hasta cinco, elegidos al azar en cada visita
   * entre los diez primeros títulos con arte apaisado de las filas. Se cambia
   * entre ellos con los puntos de debajo, SOLO a mano: un carrusel automático
   * mueve el fondo mientras alguien lee la sinopsis y, con el mando, obliga a
   * perseguir el botón.
   *
   * Nunca uno de terror: es lo primero que se ve al entrar, y en casa entra
   * todo el mundo. El terror sigue en su fila y en su género.
   *
   * Solo aparece en modo filas: en una cuadrilla la respuesta a lo pedido son
   * los resultados, y una cabecera de 70vh los empujaría fuera.
   */
  const candidatos = rows
    .flatMap((fila) => fila.items)
    .filter((item, i, todos) => item.backdrop && !item.generoIds?.includes(GENERO_TERROR) && todos.findIndex((otro) => otro.id === item.id) === i)
    .slice(0, 10);
  // eslint-disable-next-line react-hooks/purity -- RSC: corre una vez por request.
  const sorteo = candidatos.map((item) => ({ item, peso: Math.random() }));
  const elegidos = sorteo.sort((x, y) => x.peso - y.peso).slice(0, 5).map(({ item }) => item);

  /**
   * Tráiler y logo de cada destacado, en paralelo.
   *
   * Las filas no traen ni vídeos ni logos —costaría dos peticiones por cada
   * título de cada fila—; aquí son como mucho cinco títulos, dos peticiones
   * cada uno, y `tmdbConClave` las deja cacheadas un día.
   */
  const destacados = await Promise.all(
    elegidos.map(async (item) => {
      const [trailerUrl, logoUrl] =
        item.tmdbId != null
          ? await Promise.all([fetchTrailer(item.tmdbId, item.mediaType), fetchLogo(item.tmdbId, item.mediaType)])
          : [null, null];
      return { item, trailerUrl, logoUrl };
    }),
  );

  /**
   * «Explorar por plataforma», encima del catálogo. Con una plataforma
   * elegida se sigue viendo, con ella marcada: tocarla otra vez la quita.
   */
  const filaPlataformas =
    plataformas.length > 0 ? (
      <FilaPlataformas
        plataformas={plataformas}
        activa={plataforma}
        hrefDe={(id) => {
          const p = new URLSearchParams();
          if (!seccion.tipoFijo && tipo !== "todo") p.set("tipo", tipo);
          if (genero) p.set("genero", String(genero));
          if (orden !== "populares") p.set("orden", orden);
          if (id !== null) p.set("plataforma", String(id));
          const cadena = p.toString();
          return cadena ? `${base}?${cadena}` : base;
        }}
      />
    ) : null;

  /** El contenido bajo la cabecera: filas curadas o cuadrilla + paginación. */
  const resultados = cuadricula ? (
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
        detalle={plataforma ? "Prueba con otra plataforma, otro género o con «Todo»." : "Prueba con otro género o con «Todo»."}
        accion={{ href: base, texto: `Ver todo en ${seccion.titulo}` }}
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
  const contenido = conConsulta ? null : (
    <>
      {filaPlataformas}
      {resultados}
    </>
  );

  return (
    <CatalogSearch
      initialQuery={query}
      orden={orden}
      cabecera={destacados.length > 0 ? <HeroCarrusel destacados={destacados} /> : null}
      /* El nombre de la sección, además del de la barra: con tres secciones
         de catálogo parecidas, es lo que dice en cuál se está. */
      titulo={<h2 className="catalogo-titulo">{seccion.titulo}</h2>}
      filtros={
        <CatalogFilters
          base={base}
          conTipos={!seccion.tipoFijo}
          tipo={tipo}
          genero={genero}
          generos={generos}
          generosValidos={validos}
          orden={orden}
          plataforma={plataforma}
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

