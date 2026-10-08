import { describe, expect, it } from "vitest";
import { enTamano, fondoResponsivo } from "./imagen-tmdb";

const FONDO = "https://image.tmdb.org/t/p/w1280/abc.jpg";

describe("imágenes de TMDB por tamaño", () => {
  it("cambia solo el tamaño de la URL", () => {
    expect(enTamano(FONDO, "w780")).toBe("https://image.tmdb.org/t/p/w780/abc.jpg");
  });

  it("ofrece w780 y w1280 para los fondos", () => {
    const f = fondoResponsivo(FONDO);
    expect(f.src).toBe(FONDO);
    expect(f.srcSet).toBe("https://image.tmdb.org/t/p/w780/abc.jpg 780w, https://image.tmdb.org/t/p/w1280/abc.jpg 1280w");
    // 260 px × 3 (iPhone) = 780: el teléfono elige w780.
    expect(f.sizes).toContain("260px");
  });

  it("deja tal cual lo que no es de TMDB", () => {
    expect(fondoResponsivo("https://otro.cdn/foto.jpg")).toEqual({ src: "https://otro.cdn/foto.jpg" });
  });
});
