import { describe, expect, it } from "vitest";
import { conProgreso, catalogToCard } from "./media-item";
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
