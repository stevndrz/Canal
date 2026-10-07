import { describe, expect, it } from "vitest";
import { digitoDeTecla, saleDelCampo } from "./use-spatial-nav";

/** Un campo con el cursor en `cursor` (o una selección de `cursor` a `fin`). */
function campo(value: string, cursor: number | null, fin: number | null = cursor, tagName = "INPUT") {
  return { tagName, value, selectionStart: cursor, selectionEnd: fin };
}

describe("saleDelCampo", () => {
  it("↑ y ↓ siempre salen de un campo de una línea, escrito o no", () => {
    expect(saleDelCampo(campo("guate", 2), "ArrowDown")).toBe(true);
    expect(saleDelCampo(campo("", 0), "ArrowUp")).toBe(true);
  });

  it("en un área de texto, ↑ y ↓ son del cursor", () => {
    expect(saleDelCampo(campo("dos\nlíneas", 2, 2, "TEXTAREA"), "ArrowDown")).toBe(false);
  });

  it("← y → salen con el campo vacío o desde su borde", () => {
    expect(saleDelCampo(campo("", 0), "ArrowLeft")).toBe(true);
    expect(saleDelCampo(campo("guate", 0), "ArrowLeft")).toBe(true);
    expect(saleDelCampo(campo("guate", 5), "ArrowRight")).toBe(true);
  });

  it("← y → dentro del texto, o con algo seleccionado, mueven el cursor", () => {
    expect(saleDelCampo(campo("guate", 2), "ArrowLeft")).toBe(false);
    expect(saleDelCampo(campo("guate", 2), "ArrowRight")).toBe(false);
    expect(saleDelCampo(campo("guate", 0, 5), "ArrowLeft")).toBe(false);
    // Un campo sin cursor que consultar (email, number) se queda las flechas.
    expect(saleDelCampo(campo("a@b", null), "ArrowRight")).toBe(false);
  });

  it("las demás teclas nunca sacan del campo", () => {
    expect(saleDelCampo(campo("", 0), "Enter")).toBe(false);
    expect(saleDelCampo(campo("", 0), "7")).toBe(false);
  });
});

describe("digitoDeTecla", () => {
  it("lee el dígito por su nombre", () => {
    expect(digitoDeTecla({ key: "7", keyCode: 55 })).toBe("7");
    expect(digitoDeTecla({ key: "0", keyCode: 96 })).toBe("0");
  });

  it("y por su código cuando el mando no le pone nombre", () => {
    expect(digitoDeTecla({ key: "Unidentified", keyCode: 51 })).toBe("3");
    expect(digitoDeTecla({ key: "", keyCode: 105 })).toBe("9");
  });

  it("lo demás no es un dígito, aunque su código lo parezca", () => {
    expect(digitoDeTecla({ key: "a", keyCode: 65 })).toBeNull();
    expect(digitoDeTecla({ key: "ArrowUp", keyCode: 38 })).toBeNull();
    // «(» comparte el 57 con el 9 en algunos teclados: manda el nombre.
    expect(digitoDeTecla({ key: "(", keyCode: 57 })).toBeNull();
  });
});
