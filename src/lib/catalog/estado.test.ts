import { describe, expect, it } from "vitest";
import { estadoDelCatalogo } from "./estado";

describe("estadoDelCatalogo", () => {
  it("sin credencial y sin nada escrito a mano: sin configurar", () => {
    expect(estadoDelCatalogo({ configurado: false, filasConTitulos: 0 })).toBe("sin-configurar");
  });

  it("con credencial y ninguna fila: TMDB no contestó", () => {
    expect(estadoDelCatalogo({ configurado: true, filasConTitulos: 0 })).toBe("no-disponible");
  });

  it("basta con una fila para enseñar el catálogo", () => {
    expect(estadoDelCatalogo({ configurado: true, filasConTitulos: 1 })).toBe("listo");
  });

  it("lo escrito a mano cuenta como catálogo aunque TMDB falte", () => {
    expect(estadoDelCatalogo({ configurado: false, filasConTitulos: 0, propias: 3 })).toBe("listo");
  });
});
