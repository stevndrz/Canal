import { describe, expect, it } from "vitest";
import { ESPERA_CON_PUERTA_MS, ESPERA_SIN_PUERTA_MS, rescateEnTele } from "./rescate-en-tele";

describe("rescateEnTele", () => {
  it("en la app de Android no se saca a nadie de una película que va", () => {
    // El caso de las fotos del dueño: Vimeus en latino, tirado a los 20 s.
    expect(rescateEnTele({ conPuerta: false, atrasLlega: true })).toBeNull();
  });

  it("en una Samsung se devuelve el mando, pero el servidor se queda", () => {
    expect(rescateEnTele({ conPuerta: false, atrasLlega: false })).toEqual({
      esperaMs: ESPERA_SIN_PUERTA_MS,
      descartar: false,
    });
  });

  it("con puerta antirrobot se abandona en cualquier tele: no se pasa con un mando", () => {
    for (const atrasLlega of [true, false]) {
      expect(rescateEnTele({ conPuerta: true, atrasLlega })).toEqual({
        esperaMs: ESPERA_CON_PUERTA_MS,
        descartar: true,
      });
    }
  });
});
