import { describe, expect, it } from "vitest";
import { contarCosas, indiceSiguiente } from "./teclas";

describe("indiceSiguiente", () => {
  it("avanza y retrocede con las flechas de su orientación", () => {
    expect(indiceSiguiente(0, 3, "ArrowRight")).toBe(1);
    expect(indiceSiguiente(2, 3, "ArrowLeft")).toBe(1);
    expect(indiceSiguiente(0, 3, "ArrowDown", "vertical")).toBe(1);
    expect(indiceSiguiente(1, 3, "ArrowUp", "vertical")).toBe(0);
  });

  it("en el borde suelta la flecha para que el mando salga del grupo", () => {
    expect(indiceSiguiente(2, 3, "ArrowRight")).toBeNull();
    expect(indiceSiguiente(0, 3, "ArrowLeft")).toBeNull();
    expect(indiceSiguiente(0, 3, "ArrowUp", "vertical")).toBeNull();
  });

  it("ignora las flechas de la otra orientación: son para el mando", () => {
    expect(indiceSiguiente(0, 3, "ArrowDown")).toBeNull();
    expect(indiceSiguiente(0, 3, "ArrowRight", "vertical")).toBeNull();
  });

  it("con «ambas» atiende las cuatro", () => {
    expect(indiceSiguiente(0, 2, "ArrowDown", "ambas")).toBe(1);
    expect(indiceSiguiente(1, 2, "ArrowLeft", "ambas")).toBe(0);
  });

  it("Inicio y Fin van a los extremos, salvo si ya está ahí", () => {
    expect(indiceSiguiente(2, 4, "Home")).toBe(0);
    expect(indiceSiguiente(0, 4, "End")).toBe(3);
    expect(indiceSiguiente(0, 4, "Home")).toBeNull();
    expect(indiceSiguiente(3, 4, "End")).toBeNull();
  });

  it("no hace nada con otras teclas ni con un grupo vacío", () => {
    expect(indiceSiguiente(0, 3, "Enter")).toBeNull();
    expect(indiceSiguiente(0, 0, "ArrowRight")).toBeNull();
  });
});

describe("contarCosas", () => {
  it("pone el singular solo con uno", () => {
    expect(contarCosas(1, "favorito", "favoritos")).toBe("1 favorito");
    expect(contarCosas(0, "favorito", "favoritos")).toBe("0 favoritos");
    expect(contarCosas(12, "favorito", "favoritos")).toBe("12 favoritos");
  });

  it("separa los miles como se lee en español", () => {
    expect(contarCosas(4816, "canal", "canales")).toMatch(/^4.?816 canales$/);
  });
});
