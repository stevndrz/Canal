import { describe, expect, it } from "vitest";
import { ESPERA_MS, ESPERA_TELE_MS, esperaParaLaLista } from "./arranque-lista";

describe("cuándo pedir la lista completa de canales", () => {
  it("en la tele espera a que pase el arranque; en lo demás, menos", () => {
    expect(esperaParaLaLista({ vista: "player", ultimoFueraDelRecorte: false, esTV: true })).toBe(ESPERA_TELE_MS);
    expect(esperaParaLaLista({ vista: "home", ultimoFueraDelRecorte: false, esTV: false })).toBe(ESPERA_MS);
  });

  it("si el último canal no venía en el recorte, la pide ya: la tele no debe abrir en otro", () => {
    expect(esperaParaLaLista({ vista: "player", ultimoFueraDelRecorte: true, esTV: true })).toBe(0);
  });

  it("en Canales y en Buscar la lista ES la pantalla: ya", () => {
    expect(esperaParaLaLista({ vista: "canales", ultimoFueraDelRecorte: false, esTV: true })).toBe(0);
    expect(esperaParaLaLista({ vista: "buscar", ultimoFueraDelRecorte: false, esTV: false })).toBe(0);
  });
});
