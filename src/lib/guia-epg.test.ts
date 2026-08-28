import { describe, expect, it } from "vitest";
import { hora, porcentajeDelPrograma } from "./guia-epg";

const INICIO = 1_700_000_000_000;
const FIN = INICIO + 60 * 60 * 1000; // una hora

describe("porcentajeDelPrograma", () => {
  it("da null cuando falta cualquiera de los tres datos", () => {
    expect(porcentajeDelPrograma(undefined, FIN, INICIO)).toBeNull();
    expect(porcentajeDelPrograma(INICIO, undefined, INICIO)).toBeNull();
    expect(porcentajeDelPrograma(INICIO, FIN, undefined)).toBeNull();
  });

  it("da null cuando el tramo es absurdo", () => {
    expect(porcentajeDelPrograma(FIN, INICIO, FIN)).toBeNull();
    expect(porcentajeDelPrograma(INICIO, INICIO, INICIO)).toBeNull();
  });

  it("mide el avance dentro del tramo", () => {
    expect(porcentajeDelPrograma(INICIO, FIN, INICIO)).toBe(0);
    expect(porcentajeDelPrograma(INICIO, FIN, INICIO + 30 * 60 * 1000)).toBe(50);
    expect(porcentajeDelPrograma(INICIO, FIN, FIN)).toBe(100);
  });

  it("acota fuera del tramo en vez de devolver un ancho imposible", () => {
    expect(porcentajeDelPrograma(INICIO, FIN, INICIO - 10_000)).toBe(0);
    expect(porcentajeDelPrograma(INICIO, FIN, FIN + 10_000)).toBe(100);
  });
});

describe("hora", () => {
  it("devuelve cadena vacía sin instante, que es lo que la fila pinta", () => {
    expect(hora(undefined)).toBe("");
    expect(hora(0)).toBe("");
  });

  it("formatea con minutos de dos cifras", () => {
    expect(hora(INICIO)).toMatch(/^\d{1,2}:\d{2}/);
  });
});
