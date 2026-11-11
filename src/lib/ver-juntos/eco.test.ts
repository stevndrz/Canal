import { describe, expect, it } from "vitest";
import { ECO_MAXIMO_MS, TRAS_ACCION_MS, esEco, pulsoVigente } from "./eco";

const T = 1.5;

describe("esEco", () => {
  it("sin nada esperado, nada es eco", () => {
    expect(esEco(null, { tiempo: 10, pausado: false }, 0, T, "seeked")).toBe(false);
  });

  it("un seeked lento (3 s) en el sitio pedido es eco", () => {
    const esperado = { tiempo: 100, pausado: false, desde: 0 };
    expect(esEco(esperado, { tiempo: 100.2, pausado: false }, 3000, T, "seeked")).toBe(true);
  });

  it("cuenta lo que avanzó reproduciendo desde que se pidió", () => {
    const esperado = { tiempo: 100, pausado: false, desde: 0 };
    expect(esEco(esperado, { tiempo: 104, pausado: false }, 4000, T, "seeked")).toBe(true);
    // En pausa no avanza: 4 s más allá ya no es lo pedido.
    expect(esEco({ ...esperado, pausado: true }, { tiempo: 104, pausado: true }, 4000, T, "seeked")).toBe(false);
  });

  it("si la persona pausa mientras tanto, no es eco", () => {
    const esperado = { tiempo: 100, pausado: false, desde: 0 };
    expect(esEco(esperado, { tiempo: 100.5, pausado: true }, 500, T, "seeked")).toBe(false);
  });

  it("si la persona salta a otro sitio, no es eco", () => {
    const esperado = { tiempo: 100, pausado: false, desde: 0 };
    expect(esEco(esperado, { tiempo: 40, pausado: false }, 800, T, "seeked")).toBe(false);
    expect(esEco(esperado, { tiempo: 160, pausado: false }, 800, T, "seeked")).toBe(false);
  });

  it("un play que cumple lo pedido es eco aunque el salto no haya acabado", () => {
    const esperado = { tiempo: 100, pausado: false, desde: 0 };
    expect(esEco(esperado, { tiempo: 0, pausado: false }, 300, T, "play")).toBe(true);
    expect(esEco(esperado, { tiempo: 0, pausado: false }, 300, T, "seeked")).toBe(false);
    expect(esEco(esperado, { tiempo: 0, pausado: true }, 300, T, "pause")).toBe(false);
  });

  it("pasado el tope, nada es eco", () => {
    const esperado = { tiempo: 100, pausado: true, desde: 0 };
    expect(esEco(esperado, { tiempo: 100, pausado: true }, ECO_MAXIMO_MS + 1, T, "seeked")).toBe(false);
  });
});

describe("pulsoVigente", () => {
  it("un pulso que llega justo después de una acción propia es viejo y se descarta", () => {
    expect(pulsoVigente(10_000, 10_000)).toBe(false);
    expect(pulsoVigente(10_000 + TRAS_ACCION_MS - 1, 10_000)).toBe(false);
  });

  it("pasado ese rato, el pulso ya trae la respuesta de quien dirige: se obedece", () => {
    expect(pulsoVigente(10_000 + TRAS_ACCION_MS, 10_000)).toBe(true);
    // Sin ninguna acción propia todavía (0), cualquier pulso vale.
    expect(pulsoVigente(10_000, 0)).toBe(true);
  });
});
