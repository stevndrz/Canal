import { describe, expect, it } from "vitest";
import { MAX_BUSQUEDAS, agregarBusqueda, interpretarBusquedas, quitarBusqueda } from "./busquedas-recientes";

describe("búsquedas recientes", () => {
  it("la nueva va delante y no se repite, sin mirar mayúsculas", () => {
    expect(agregarBusqueda(["Batman", "Shrek"], "  shrek ")).toEqual(["shrek", "Batman"]);
  });

  it("ignora lo vacío o de una letra", () => {
    expect(agregarBusqueda(["Batman"], " ")).toEqual(["Batman"]);
    expect(agregarBusqueda(["Batman"], "a")).toEqual(["Batman"]);
  });

  it("recuerda como mucho las últimas", () => {
    let lista: string[] = [];
    for (let i = 0; i < MAX_BUSQUEDAS + 3; i++) lista = agregarBusqueda(lista, `titulo ${i}`);
    expect(lista).toHaveLength(MAX_BUSQUEDAS);
    expect(lista[0]).toBe(`titulo ${MAX_BUSQUEDAS + 2}`);
  });

  it("quita una sola", () => {
    expect(quitarBusqueda(["a b", "c d"], "a b")).toEqual(["c d"]);
  });

  it("lo guardado roto no rompe la página", () => {
    expect(interpretarBusquedas(null)).toEqual([]);
    expect(interpretarBusquedas("{no es json")).toEqual([]);
    expect(interpretarBusquedas('{"a":1}')).toEqual([]);
    expect(interpretarBusquedas('["Shrek", 3, null, "Batman"]')).toEqual(["Shrek", "Batman"]);
  });
});
