import { describe, expect, it } from "vitest";
import { desfaseDeBarras, estaRebotando, type MedidasViewport } from "./viewport-visible";

/** Tras cerrar el teclado y con la página quieta: el único caso en que se corrige. */
const medir = (m: Partial<MedidasViewport>) =>
  desfaseDeBarras({ offsetTop: 0, height: 844, scale: 1, innerHeight: 844, trasTeclado: true, rebote: false, ...m });

describe("barras del teléfono pegadas a lo visible", () => {
  it("en el caso normal no mueve nada", () => {
    expect(medir({ offsetTop: 0, height: 844, scale: 1, innerHeight: 844 })).toEqual({ arriba: 0, abajo: 0 });
  });

  it("con el área visible desplazada tras cerrar el teclado, las devuelve a su sitio", () => {
    // La captura del dueño: ~117 px corridas, la de abajo fuera de la pantalla.
    expect(medir({ offsetTop: -117, height: 844, scale: 1, innerHeight: 844 })).toEqual({ arriba: -117, abajo: -117 });
    expect(medir({ offsetTop: 80, height: 844, scale: 1, innerHeight: 844 })).toEqual({ arriba: 80, abajo: 80 });
  });

  it("con el teclado abierto, la de arriba sigue a lo visible y la de abajo se queda", () => {
    expect(medir({ offsetTop: 200, height: 480, scale: 1, innerHeight: 844 })).toEqual({ arriba: 200, abajo: 0 });
  });

  it("con zoom de pellizco no toca nada", () => {
    expect(medir({ offsetTop: 300, height: 400, scale: 2, innerHeight: 844 })).toEqual({ arriba: 0, abajo: 0 });
  });

  it("al tirar de la página (rebote de iOS) no toca nada: Safari ya arrastra las barras", () => {
    // Las capturas del dueño: lo visible corrido cientos de píxeles mientras
    // se tira hacia abajo o hacia arriba, y las barras flotando en medio.
    expect(medir({ offsetTop: -180, rebote: true })).toEqual({ arriba: 0, abajo: 0 });
    expect(medir({ offsetTop: 240, rebote: true })).toEqual({ arriba: 0, abajo: 0 });
  });

  it("sin teclado de por medio tampoco: no hay fallo de Safari que corregir", () => {
    expect(medir({ offsetTop: -117, trasTeclado: false })).toEqual({ arriba: 0, abajo: 0 });
    expect(medir({ offsetTop: 0, height: 760, trasTeclado: false })).toEqual({ arriba: 0, abajo: 0 });
  });
});

describe("estaRebotando", () => {
  it("dentro de la página, no", () => {
    expect(estaRebotando(0, 3000, 844)).toBe(false);
    expect(estaRebotando(1200, 3000, 844)).toBe(false);
    expect(estaRebotando(2156, 3000, 844)).toBe(false);
  });

  it("más arriba del principio o más abajo del final, sí", () => {
    expect(estaRebotando(-60, 3000, 844)).toBe(true);
    expect(estaRebotando(2300, 3000, 844)).toBe(true);
    // Una página más corta que la pantalla también rebota.
    expect(estaRebotando(40, 600, 844)).toBe(true);
  });
});
