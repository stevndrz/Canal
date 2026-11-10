import { beforeEach, describe, expect, it, vi } from "vitest";

/** Lo que recibiría Vercel Analytics; con `romper`, como si una extensión lo bloqueara. */
const enviados: unknown[][] = [];
const analitica = { romper: false };
vi.mock("@vercel/analytics", () => ({
  track: (...args: unknown[]) => {
    if (analitica.romper) throw new Error("bloqueado por una extensión");
    enviados.push(args);
  },
}));

const { crearFreno, registrarSala } = await import("./metricas");

describe("crearFreno", () => {
  it("el mismo fallo, una vez cada tanto; fallos distintos no se estorban", () => {
    const pasa = crearFreno(30_000, 100);
    expect(pasa("corte", 0)).toBe(true);
    expect(pasa("corte", 10_000)).toBe(false);
    expect(pasa("desincronia", 10_000)).toBe(true);
    expect(pasa("corte", 30_000)).toBe(true);
  });

  it("tiene un tope por visita, por si algo entra en bucle", () => {
    const pasa = crearFreno(0, 3);
    expect([1, 2, 3, 4, 5].map((n) => pasa(`fallo-${n}`, n))).toEqual([true, true, true, false, false]);
  });
});

describe("registrarSala", () => {
  beforeEach(() => {
    enviados.length = 0;
    analitica.romper = false;
  });

  it("manda el evento con su nombre y sus datos, y no lo repite enseguida", () => {
    registrarSala("desincronia", { s: 4, atras: 1 });
    registrarSala("desincronia", { s: 5, atras: 1 });
    expect(enviados).toEqual([["sala_desincronia", { s: 4, atras: 1 }]]);
  });

  it("si medir falla, no se entera nadie: nunca rompe la película", () => {
    analitica.romper = true;
    expect(() => registrarSala("sin_conexion", { motivo: "firma" })).not.toThrow();
    expect(enviados).toEqual([]);
  });
});
