import { describe, expect, it } from "vitest";
import { CATEGORY_ORDER, classifyChannel, compareByCategory } from "./categories";

describe("classifyChannel", () => {
  it("manda el país declarado por encima del nombre", () => {
    // El caso que motivó la regla: hay un "Canal 3" en Formosa y un "Tigo
    // Sports" en Bolivia. Si la lista dice de qué país son, el nombre no se
    // consulta, o acaban los dos en la categoría de Guatemala.
    expect(classifyChannel({ name: "Canal 3", country: "AR" })).not.toBe("Guatemala");
    expect(classifyChannel({ name: "Tigo Sports", country: "BO" })).not.toBe("Guatemala");
    expect(classifyChannel({ name: "Canal 3", country: "GT" })).toBe("Guatemala");
  });

  it("reconoce Guatemala por el nombre cuando la lista no dice el país", () => {
    expect(classifyChannel({ name: "Guatevision" })).toBe("Guatemala");
    expect(classifyChannel({ name: "TN23" })).toBe("Guatemala");
  });

  it("clasifica por contenido cuando no hay señal de país", () => {
    expect(classifyChannel({ name: "ESPN Deportes" })).toBe("Deportes");
    expect(classifyChannel({ name: "Cartoon Network" })).toBe("Infantil");
  });

  it("cae en Internacional en vez de fallar ante algo irreconocible", () => {
    expect(classifyChannel({ name: "zzz 9999" })).toBe("Internacional");
  });
});

describe("compareByCategory", () => {
  it("ordena según CATEGORY_ORDER", () => {
    const [primera, segunda] = CATEGORY_ORDER;
    expect(compareByCategory(primera, segunda)).toBeLessThan(0);
    expect(compareByCategory(segunda, primera)).toBeGreaterThan(0);
    expect(compareByCategory(primera, primera)).toBe(0);
  });

  it("manda las categorías desconocidas al final, no al principio", () => {
    // `indexOf` da -1 para lo desconocido: sin tratarlo, restar pondría lo
    // raro delante de todo.
    expect(compareByCategory("Inventada", CATEGORY_ORDER[0])).toBeGreaterThan(0);
    expect(compareByCategory(CATEGORY_ORDER[0], "Inventada")).toBeLessThan(0);
  });
});
