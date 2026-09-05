import { describe, expect, it } from "vitest";
import {
  MAX_EN_CURSO,
  OLVIDO_EN_CURSO_MS,
  type EnCurso,
  type MemoriaEnCurso,
  anotar,
  enCursoOrdenado,
  olvidarEnCurso,
  podarEnCurso,
  resumen,
} from "./continuar";

function serie(episodio: number, visto = 1_000): EnCurso {
  return {
    clave: "tv-tmdb-125988",
    mediaType: "tv",
    id: "tmdb-125988",
    titulo: "Silo",
    poster: "/p.jpg",
    backdrop: "/b.jpg",
    temporada: 1,
    episodio,
    tituloEpisodio: `Capítulo ${episodio}`,
    visto,
  };
}

describe("anotar", () => {
  it("una entrada por título, no una por episodio", () => {
    // Quien va por el cuarto capítulo quiere una tarjeta que diga «T1 E4», no
    // cuatro tarjetas de la misma serie llenando la fila.
    let memoria: MemoriaEnCurso = {};
    for (const n of [1, 2, 3, 4]) memoria = anotar(memoria, serie(n, 1_000 + n));
    expect(Object.keys(memoria)).toHaveLength(1);
    expect(memoria["tv-tmdb-125988"].episodio).toBe(4);
  });

  it("devuelve el MISMO objeto si nada cambió", () => {
    // Reabrir la ficha sin tocar nada no debe reordenar la fila ni repintar.
    const memoria = anotar({}, serie(3));
    expect(anotar(memoria, serie(3, 9_999))).toBe(memoria);
  });

  it("un porcentaje nuevo sí cuenta como cambio", () => {
    const memoria = anotar({}, serie(3));
    const conBarra = anotar(memoria, { ...serie(3), porcentaje: 40 });
    expect(conBarra["tv-tmdb-125988"].porcentaje).toBe(40);
  });
});

describe("enCursoOrdenado", () => {
  it("lo último que se abrió va primero", () => {
    let memoria: MemoriaEnCurso = {};
    memoria = anotar(memoria, { ...serie(1, 1_000), clave: "tv-a", id: "a" });
    memoria = anotar(memoria, { ...serie(1, 5_000), clave: "tv-b", id: "b" });
    expect(enCursoOrdenado(memoria).map((e) => e.clave)).toEqual(["tv-b", "tv-a"]);
  });
});

describe("olvidarEnCurso", () => {
  it("lo que se quita de la fila no vuelve", () => {
    const memoria = anotar({}, serie(1));
    expect(olvidarEnCurso(memoria, "tv-tmdb-125988")).toEqual({});
  });

  it("olvidar lo que no está no cambia nada", () => {
    const memoria = anotar({}, serie(1));
    expect(olvidarEnCurso(memoria, "otra")).toBe(memoria);
  });
});

describe("podarEnCurso", () => {
  it("olvida lo que lleva cuatro meses sin abrirse", () => {
    const memoria = anotar({}, serie(1, 1_000));
    expect(podarEnCurso(memoria, 1_000 + OLVIDO_EN_CURSO_MS + 1)).toEqual({});
  });

  it("no crece sin fin: se queda con lo más reciente", () => {
    let memoria: MemoriaEnCurso = {};
    for (let i = 0; i < MAX_EN_CURSO + 10; i++) {
      memoria = anotar(memoria, { ...serie(1, 1_000 + i), clave: `tv-${i}`, id: String(i) });
    }
    expect(Object.keys(memoria)).toHaveLength(MAX_EN_CURSO);
    expect(memoria[`tv-${MAX_EN_CURSO + 9}`]).toBeDefined();
    expect(memoria["tv-0"]).toBeUndefined();
  });

  it("devuelve el MISMO objeto cuando no hay nada que podar", () => {
    const memoria = anotar({}, serie(1, 1_000));
    expect(podarEnCurso(memoria, 1_000)).toBe(memoria);
  });
});

describe("resumen", () => {
  it("una serie dice por dónde va", () => {
    expect(resumen(serie(4))).toBe("T1 E4 · Capítulo 4");
  });

  it("sin título de capítulo se queda en el código", () => {
    expect(resumen({ ...serie(4), tituloEpisodio: undefined })).toBe("T1 E4");
  });

  it("una película no inventa temporadas", () => {
    const peli: EnCurso = {
      clave: "movie-tmdb-550",
      mediaType: "movie",
      id: "tmdb-550",
      titulo: "El club de la lucha",
      poster: null,
      backdrop: null,
      visto: 1,
    };
    expect(resumen(peli)).toBe("Película");
  });
});
