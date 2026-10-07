import { describe, expect, it } from "vitest";
import { leerRespuestaBusqueda } from "./busqueda";

describe("leerRespuestaBusqueda", () => {
  it("con resultados, los devuelve", () => {
    expect(leerRespuestaBusqueda(200, { resultados: [1, 2], disponible: true })).toEqual({
      estado: "ok",
      resultados: [1, 2],
    });
  });

  it("una lista vacía con TMDB disponible es «no hay nada», no un fallo", () => {
    expect(leerRespuestaBusqueda(200, { resultados: [], disponible: true })).toEqual({
      estado: "ok",
      resultados: [],
    });
  });

  it("TMDB caído no se confunde con «sin resultados»", () => {
    expect(leerRespuestaBusqueda(503, { resultados: [], disponible: false }).estado).toBe("no-disponible");
    expect(leerRespuestaBusqueda(200, { resultados: [], disponible: false }).estado).toBe("no-disponible");
  });

  it("el límite de peticiones se dice como tal", () => {
    expect(leerRespuestaBusqueda(429, { error: "Demasiadas peticiones." }).estado).toBe("limitado");
  });

  it("un cuerpo que no se entiende es un fallo, no una lista vacía", () => {
    expect(leerRespuestaBusqueda(200, null).estado).toBe("no-disponible");
    expect(leerRespuestaBusqueda(200, { otra: "cosa" }).estado).toBe("no-disponible");
  });

  it("acepta la respuesta antigua sin `disponible`", () => {
    expect(leerRespuestaBusqueda(200, { resultados: [] }).estado).toBe("ok");
  });
});
