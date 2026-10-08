import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { GUION_COMPATIBILIDAD } from "./compat-tv";

const require = createRequire(import.meta.url);
const { aproximar } = require("../../scripts/postcss-respaldo-tv.cjs") as {
  aproximar: (valor: string) => string;
};

describe("guion de compatibilidad de las teles de 2019", () => {
  it("es JavaScript que un navegador viejo puede leer (sin sintaxis moderna)", () => {
    expect(() => new Function(GUION_COMPATIBILIDAD)).not.toThrow();
    for (const moderno of ["?.", "??", "=>", "`", "let ", "const ", "class "]) {
      expect(GUION_COMPATIBILIDAD).not.toContain(moderno);
    }
  });

  it("en un navegador moderno no toca nada", () => {
    // Aquí (Node) `globalThis` existe: la red de seguridad no debe ni mirar el DOM.
    expect(() => new Function(GUION_COMPATIBILIDAD)()).not.toThrow();
  });
});

describe("respaldo de clamp/min/max para la tele", () => {
  it("toma el máximo de un clamp, que es el valor a 1920 px", () => {
    expect(aproximar("clamp(20px, 4.2vw, 88px)")).toBe("88px");
    expect(aproximar("0 clamp(11px, 1vw, 18px)")).toBe("0 18px");
  });

  it("resuelve funciones anidadas y dentro de calc()", () => {
    expect(aproximar("calc(clamp(68px, 8.4vh, 92px) + var(--safe-top))")).toBe("calc(92px + var(--safe-top))");
    expect(aproximar("calc((min(100vw, 1740px) - 96px) / 6)")).toBe("calc((1740px - 96px) / 6)");
    expect(aproximar("clamp(104px, calc((min(100vw, 1740px) - 96px) / 9), 168px)")).toBe("168px");
  });

  it("no confunde minmax() con min()", () => {
    expect(aproximar("repeat(auto-fill, minmax(200px, 1fr))")).toBe("repeat(auto-fill, minmax(200px, 1fr))");
  });
});
