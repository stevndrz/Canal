import { describe, expect, it } from "vitest";
import { formatearDuracion, formatearNota } from "./formato";

describe("formatearNota", () => {
  it("usa coma decimal y siempre un decimal", () => {
    expect(formatearNota(6.5)).toBe("6,5");
    expect(formatearNota(8)).toBe("8,0");
    expect(formatearNota(7.25)).toMatch(/^7,[23]$/);
  });
});

describe("formatearDuracion", () => {
  it("dice horas y minutos como se dicen", () => {
    expect(formatearDuracion(125)).toBe("2 h 5 min");
    expect(formatearDuracion(120)).toBe("2 h");
    expect(formatearDuracion(48)).toBe("48 min");
  });

  it("no inventa una duración que no hay", () => {
    expect(formatearDuracion(null)).toBeNull();
    expect(formatearDuracion(0)).toBeNull();
  });
});
