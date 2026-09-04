import { describe, expect, it } from "vitest";
import { catalogToCard, claveCatalogo, conEnLista, conProgreso, enMiLista, seguirViendo } from "./media-item";
import { claveDeTitulo, type MemoriaProgreso } from "./progreso";
import type { ResolvedCatalogItem } from "./catalog/types";

/** Una ficha de TMDB como las que llegan del servidor. */
const PELICULA = {
  id: 123,
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
    expect(catalogToCard(PELICULA).key).toBe(claveDeTitulo("movie", 123));
  });

  it("pinta la barra de lo que se dejó a medias", () => {
    const memoria: MemoriaProgreso = { "movie-123": A_MITAD };
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
      "movie-123": { posicion: 89 * 60, duracion: 90 * 60, visto: 1_000 },
    };
    expect(conProgreso(catalogToCard(PELICULA), memoria).progress).toBeUndefined();
  });

  it("el capítulo a medias no le pone barra a la serie entera", () => {
    // Una serie no está «al 40%» porque su tercer capítulo lo esté.
    const serie = { ...PELICULA, mediaType: "tv", id: 42 } as unknown as ResolvedCatalogItem;
    const memoria: MemoriaProgreso = { [claveDeTitulo("tv", 42, 1, 3)]: A_MITAD };
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

describe("seguirViendo", () => {
  const serie = { ...PELICULA, mediaType: "tv", id: 42, title: "Una serie" } as unknown as ResolvedCatalogItem;
  const filas = [{ tarjetas: [catalogToCard(PELICULA), catalogToCard(serie)] }];

  it("ordena de lo más reciente a lo más viejo", () => {
    const memoria: MemoriaProgreso = {
      "movie-123": { ...A_MITAD, visto: 1_000 },
      "tv-42": { ...A_MITAD, visto: 2_000 },
    };
    expect(seguirViendo(filas, memoria).map((t) => t.key)).toEqual(["tv-42", "movie-123"]);
  });

  it("omite lo que no llegó en las filas curadas", () => {
    const memoria: MemoriaProgreso = { "movie-999": A_MITAD };
    expect(seguirViendo(filas, memoria)).toEqual([]);
  });

  it("omite lo terminado o lo apenas empezado, igual que conProgreso", () => {
    const memoria: MemoriaProgreso = {
      "movie-123": { posicion: 89 * 60, duracion: 90 * 60, visto: 1_000 },
    };
    expect(seguirViendo(filas, memoria)).toEqual([]);
  });
});

describe("enMiLista", () => {
  const serie = { ...PELICULA, mediaType: "tv", id: 42, title: "Una serie" } as unknown as ResolvedCatalogItem;
  const filas = [{ tarjetas: [catalogToCard(PELICULA), catalogToCard(serie)] }];

  it("solo devuelve lo marcado, en el orden de las filas", () => {
    const ids = new Set(["tv-42"]);
    const resultado = enMiLista(filas, ids);
    expect(resultado.map((t) => t.key)).toEqual(["tv-42"]);
    expect(resultado[0].enLista).toBe(true);
  });

  it("sin nada marcado, la lista está vacía", () => {
    expect(enMiLista(filas, new Set())).toEqual([]);
  });
});
