import { describe, expect, it } from "vitest";
import { clasificarSonda, puntuarSonda } from "./sonda-salud";

describe("puntuarSonda", () => {
  it("sin respuesta no hay puntos", () => {
    expect(puntuarSonda({ ok: false })).toBe(0);
  });

  it("rápida y con manifiesto puntúa alto", () => {
    expect(puntuarSonda({ ok: true, ttffMs: 800, esM3u8: true })).toBeGreaterThanOrEqual(70);
  });

  it("lenta pero viva puntúa bajo sin ser cero", () => {
    const puntos = puntuarSonda({ ok: true, ttffMs: 7000 });
    expect(puntos).toBeGreaterThan(0);
    expect(puntos).toBeLessThan(70);
  });
});

describe("clasificarSonda", () => {
  it("corta en buena/regular/mala", () => {
    expect(clasificarSonda(90)).toBe("buena");
    expect(clasificarSonda(50)).toBe("regular");
    expect(clasificarSonda(10)).toBe("mala");
  });
});
