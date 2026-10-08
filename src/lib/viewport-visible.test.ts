import { describe, expect, it } from "vitest";
import { desfaseDeBarras } from "./viewport-visible";

describe("barras del teléfono pegadas a lo visible", () => {
  it("en el caso normal no mueve nada", () => {
    expect(desfaseDeBarras({ offsetTop: 0, height: 844, scale: 1, innerHeight: 844 })).toEqual({ arriba: 0, abajo: 0 });
  });

  it("con el área visible desplazada tras cerrar el teclado, las devuelve a su sitio", () => {
    // La captura del dueño: ~117 px corridas, la de abajo fuera de la pantalla.
    expect(desfaseDeBarras({ offsetTop: -117, height: 844, scale: 1, innerHeight: 844 })).toEqual({ arriba: -117, abajo: -117 });
    expect(desfaseDeBarras({ offsetTop: 80, height: 844, scale: 1, innerHeight: 844 })).toEqual({ arriba: 80, abajo: 80 });
  });

  it("con el teclado abierto, la de arriba sigue a lo visible y la de abajo se queda", () => {
    expect(desfaseDeBarras({ offsetTop: 200, height: 480, scale: 1, innerHeight: 844 })).toEqual({ arriba: 200, abajo: 0 });
  });

  it("con zoom de pellizco no toca nada", () => {
    expect(desfaseDeBarras({ offsetTop: 300, height: 400, scale: 2, innerHeight: 844 })).toEqual({ arriba: 0, abajo: 0 });
  });
});
