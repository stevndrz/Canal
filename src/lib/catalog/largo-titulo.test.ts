import { describe, expect, it } from "vitest";
import { largoDeTitulo } from "./largo-titulo";

describe("talla del título de la ficha", () => {
  it("un título corto llena la portada y uno largo se contiene", () => {
    expect(largoDeTitulo("Overflow")).toBe("xs");
    expect(largoDeTitulo("The Last of Us")).toBe("corto");
    expect(largoDeTitulo("Spider-Man: Across the Spider")).toBe("medio");
    expect(largoDeTitulo("La noche del demonio: Están entre nosotros")).toBe("largo");
  });

  it("no cuenta los espacios de los bordes", () => {
    expect(largoDeTitulo("  Dune  ")).toBe("xs");
  });
});
