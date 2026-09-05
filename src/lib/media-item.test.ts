import { describe, expect, it } from "vitest";
import { catalogToCard, claveCatalogo, conEnLista, conProgreso, enCursoACard, enMiLista } from "./media-item";
import type { EnCurso } from "./continuar";
import { claveDeTitulo, type MemoriaProgreso } from "./progreso";
import type { ResolvedCatalogItem } from "./catalog/types";

/** Una ficha de TMDB como las que llegan del servidor. */
const PELICULA = {
  id: "tmdb-123",
  mediaType: "movie",
  title: "Una película",
  poster: "/p.jpg",
  backdrop: "/b.jpg",
  year: 2026,
} as unknown as ResolvedCatalogItem;

/** Media película, de hora y media. */
const A_MITAD = { posicion: 45 * 60, duracion: 90 * 60, visto: 1_000 };

describe("conProgreso", () => {
  it("la clave de la tarjeta y la del progreso son la misma cadena", () => {
    // De esto depende que cruzarlas sea una búsqueda directa, sin índice
    // aparte. Si un día cambia una de las dos, esto se pone rojo.
    //
    // Este test existía y pasaba mientras la app fallaba: el `id` del fixture
    // era `123` a secas, y los de TMDB son `tmdb-123`. Con el desnudo las dos
    // claves salían iguales por casualidad; con el real, el progreso guardaba
    // en `movie-123` y la tarjeta preguntaba por `movie-tmdb-123`, así que
    // ninguna barra se pintó nunca. El fixture ahora usa un id de verdad.
    expect(catalogToCard(PELICULA).key).toBe("movie-tmdb-123");
    expect(catalogToCard(PELICULA).key).toBe(claveDeTitulo(claveCatalogo(PELICULA)));
  });

  it("pinta la barra de lo que se dejó a medias", () => {
    const memoria: MemoriaProgreso = { "movie-tmdb-123": A_MITAD };
    expect(conProgreso(catalogToCard(PELICULA), memoria).progress).toBe(50);
  });

  it("devuelve la MISMA tarjeta si no hay nada que añadir", () => {
    // `MediaRail` compara por identidad: un objeto nuevo por tarjeta en cada
    // render repintaría todos los carriles del catálogo para nada.
    const tarjeta = catalogToCard(PELICULA);
    expect(conProgreso(tarjeta, {})).toBe(tarjeta);
  });

  it("no pinta barra de algo ya terminado", () => {
    const memoria: MemoriaProgreso = {
      "movie-tmdb-123": { posicion: 89 * 60, duracion: 90 * 60, visto: 1_000 },
    };
    expect(conProgreso(catalogToCard(PELICULA), memoria).progress).toBeUndefined();
  });

  it("el capítulo a medias no le pone barra a la serie entera", () => {
    // Una serie no está «al 40%» porque su tercer capítulo lo esté.
    const serie = { ...PELICULA, mediaType: "tv", id: "tmdb-42" } as unknown as ResolvedCatalogItem;
    const memoria: MemoriaProgreso = { [claveDeTitulo(claveCatalogo(serie), 1, 3)]: A_MITAD };
    expect(conProgreso(catalogToCard(serie), memoria).progress).toBeUndefined();
  });
});

describe("claveCatalogo", () => {
  it("distingue una película de una serie con el mismo id", () => {
    const peli = { mediaType: "movie", id: "tmdb-1396" } as const;
    const serie = { mediaType: "tv", id: "tmdb-1396" } as const;
    expect(claveCatalogo(peli)).not.toBe(claveCatalogo(serie));
  });
});

describe("conEnLista", () => {
  it("marca la tarjeta cuando su clave está en el set", () => {
    const tarjeta = catalogToCard(PELICULA);
    expect(conEnLista(tarjeta, new Set([tarjeta.key])).enLista).toBe(true);
  });

  it("devuelve la MISMA tarjeta si no hay nada que cambiar", () => {
    const tarjeta = catalogToCard(PELICULA);
    expect(conEnLista(tarjeta, new Set())).toBe(tarjeta);
  });

  it("desmarca si ya no está en la lista", () => {
    const tarjeta = { ...catalogToCard(PELICULA), enLista: true };
    expect(conEnLista(tarjeta, new Set()).enLista).toBe(false);
  });
});

describe("enCursoACard", () => {
  const serie: EnCurso = {
    clave: "tv-tmdb-125988",
    mediaType: "tv",
    id: "tmdb-125988",
    titulo: "Silo",
    poster: "/p.jpg",
    backdrop: "/b.jpg",
    temporada: 1,
    episodio: 4,
    tituloEpisodio: "El truco",
    visto: 1_000,
  };

  it("la línea de debajo dice por dónde vas, no el año", () => {
    // En una fila de continuar es lo único que importa.
    expect(enCursoACard(serie, {}).meta).toBe("T1 E4 · El truco");
  });

  it("la tarjeta conserva la clave de la SERIE, no la del capítulo", () => {
    // Es la que abre la ficha; con la del episodio, el enlace no existiría.
    expect(enCursoACard(serie, {}).key).toBe("tv-tmdb-125988");
  });

  it("la barra sale de la clave del capítulo", () => {
    const memoria: MemoriaProgreso = { "tv-tmdb-125988-t1e4": A_MITAD };
    expect(enCursoACard(serie, memoria).progress).toBe(50);
  });

  it("sin nada guardado va sin barra: casi todos los servidores son iframes", () => {
    // Mejor sin barra que con una inventada.
    expect(enCursoACard(serie, {}).progress).toBeUndefined();
  });

  it("no confunde el progreso de la serie con el del capítulo", () => {
    const memoria: MemoriaProgreso = { "tv-tmdb-125988": A_MITAD };
    expect(enCursoACard(serie, memoria).progress).toBeUndefined();
  });
});

describe("enMiLista", () => {
  const serie = { ...PELICULA, mediaType: "tv", id: "tmdb-42", title: "Una serie" } as unknown as ResolvedCatalogItem;
  const filas = [{ tarjetas: [catalogToCard(PELICULA), catalogToCard(serie)] }];

  it("solo devuelve lo marcado, en el orden de las filas", () => {
    const ids = new Set(["tv-tmdb-42"]);
    const resultado = enMiLista(filas, ids);
    expect(resultado.map((t) => t.key)).toEqual(["tv-tmdb-42"]);
    expect(resultado[0].enLista).toBe(true);
  });

  it("sin nada marcado, la lista está vacía", () => {
    expect(enMiLista(filas, new Set())).toEqual([]);
  });
});
