import { describe, expect, it } from "vitest";
import {
  MAX_DIGITOS,
  canalDeMarcado,
  decidir,
  indexarParaMarcado,
  siguienteMarcado,
} from "./marcado";

/** Una lista como la que produce `desempaquetarCanales`. */
const CANALES = [
  { number: "101", name: "Canal 3" },
  { number: "102", name: "Canal 7" },
  { number: "307", name: "Guatevisión" },
  { number: "3070", name: "Uno raro" },
  { number: "201", name: "Deportes" },
];
const INDICE = indexarParaMarcado(CANALES);

describe("siguienteMarcado", () => {
  it("acumula dígitos", () => {
    expect(siguienteMarcado("", "3")).toBe("3");
    expect(siguienteMarcado("30", "7")).toBe("307");
  });

  it("ignora lo que no es un dígito", () => {
    expect(siguienteMarcado("3", "a")).toBeNull();
  });

  it("un cero a la izquierda no empieza ningún canal", () => {
    expect(siguienteMarcado("", "0")).toBeNull();
    // Pero dentro del número sí vale.
    expect(siguienteMarcado("1", "0")).toBe("10");
  });

  it("**pasado el tope se ignora, no se reinicia**", () => {
    // Quien teclea un dígito de más se ha equivocado; empezar de cero con ese
    // dígito suelto le llevaría a un canal cualquiera.
    const lleno = "1".repeat(MAX_DIGITOS);
    expect(siguienteMarcado(lleno, "5")).toBeNull();
  });
});

describe("decidir", () => {
  it("un número incompleto espera", () => {
    expect(decidir(INDICE, "1")).toEqual({ tipo: "seguir" });
    expect(decidir(INDICE, "10")).toEqual({ tipo: "seguir" });
  });

  it("**salta en cuanto no cabe duda**", () => {
    // Nada más empieza por 101, así que no hay nada que esperar. Es lo que hace
    // que marcar un número completo se sienta instantáneo.
    expect(decidir(INDICE, "101")).toEqual({ tipo: "saltar" });
  });

  it("un número que es prefijo de otro más largo espera", () => {
    // El 307 existe, pero también el 3070: hay que darle ocasión de crecer.
    expect(decidir(INDICE, "307")).toEqual({ tipo: "seguir" });
    // Y el largo sí salta, que ya no puede crecer más.
    expect(decidir(INDICE, "3070")).toEqual({ tipo: "saltar" });
  });

  it("lo que no empieza ningún canal se dice de inmediato", () => {
    // Sin esto, marcar «9» dejaría dos segundos de espera para nada.
    expect(decidir(INDICE, "9")).toEqual({ tipo: "no-existe" });
    expect(decidir(INDICE, "108")).toEqual({ tipo: "no-existe" });
  });
});

describe("canalDeMarcado", () => {
  it("encuentra por número exacto", () => {
    expect(canalDeMarcado(INDICE, "307")?.name).toBe("Guatevisión");
  });

  it("un número que no existe no devuelve nada", () => {
    expect(canalDeMarcado(INDICE, "999")).toBeNull();
  });

  it("con números repetidos gana el que sale antes en la lista", () => {
    const indice = indexarParaMarcado([
      { number: "101", name: "Primero" },
      { number: "101", name: "Segundo" },
    ]);
    expect(canalDeMarcado(indice, "101")?.name).toBe("Primero");
  });
});

describe("el índice", () => {
  it("cuenta cuántos empiezan por cada comienzo", () => {
    // De esto depende saber si algo puede crecer sin recorrer la lista.
    expect(INDICE.cuantosEmpiezanPor.get("1")).toBe(2);
    expect(INDICE.cuantosEmpiezanPor.get("30")).toBe(2);
    expect(INDICE.cuantosEmpiezanPor.get("307")).toBe(2);
    expect(INDICE.cuantosEmpiezanPor.get("3070")).toBe(1);
  });

  it("aguanta un canal sin número sin romperse", () => {
    const indice = indexarParaMarcado([{ number: "", name: "Sin número" }]);
    expect(indice.exactos.size).toBe(0);
  });
});
