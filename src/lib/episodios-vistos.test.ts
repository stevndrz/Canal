import { describe, expect, it } from "vitest";
import {
  claveDeEpisodio,
  cuantosVistos,
  estaVisto,
  filtrarEpisodios,
  siguientePorVer,
} from "./episodios-vistos";

const BASE = "tv-tmdb-125988";
const TEMPORADA = [1, 2, 3, 4].map((episode) => ({ season: 1, episode }));

/** Los episodios 1 y 2 vistos, 3 y 4 no. */
const VISTOS = new Set([`${BASE}-t1e1`, `${BASE}-t1e2`]);

describe("claveDeEpisodio", () => {
  it("es la misma clave que usa el progreso", () => {
    // Una sola cadena identifica un capítulo en las dos memorias.
    expect(claveDeEpisodio(BASE, { season: 2, episode: 7 })).toBe(`${BASE}-t2e7`);
  });
});

describe("estaVisto y cuantosVistos", () => {
  it("cuenta lo marcado y solo lo marcado", () => {
    expect(estaVisto(VISTOS, BASE, { season: 1, episode: 2 })).toBe(true);
    expect(estaVisto(VISTOS, BASE, { season: 1, episode: 3 })).toBe(false);
    expect(cuantosVistos(VISTOS, BASE, TEMPORADA)).toBe(2);
  });

  it("no confunde temporadas ni series", () => {
    expect(estaVisto(VISTOS, BASE, { season: 2, episode: 1 })).toBe(false);
    expect(estaVisto(VISTOS, "tv-tmdb-1", { season: 1, episode: 1 })).toBe(false);
  });
});

describe("siguientePorVer", () => {
  it("es el primero sin marcar", () => {
    expect(siguientePorVer(VISTOS, BASE, TEMPORADA)?.episode).toBe(3);
  });

  it("con la temporada entera vista, vuelve al principio", () => {
    // Entrar y que la pantalla no ofrezca nada sería peor que repetir.
    const todos = new Set(TEMPORADA.map((e) => claveDeEpisodio(BASE, e)));
    expect(siguientePorVer(todos, BASE, TEMPORADA)?.episode).toBe(1);
  });

  it("sin episodios no hay siguiente", () => {
    expect(siguientePorVer(VISTOS, BASE, [])).toBeNull();
  });
});

describe("filtrarEpisodios", () => {
  it("reparte la lista sin reordenarla", () => {
    // Marcar un capítulo no debe hacer que el de al lado salte de sitio.
    expect(filtrarEpisodios(TEMPORADA, VISTOS, BASE, "todos")).toHaveLength(4);
    expect(filtrarEpisodios(TEMPORADA, VISTOS, BASE, "vistos").map((e) => e.episode)).toEqual([1, 2]);
    expect(filtrarEpisodios(TEMPORADA, VISTOS, BASE, "porver").map((e) => e.episode)).toEqual([3, 4]);
  });
});
