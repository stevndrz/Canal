import { describe, expect, it } from "vitest";
import {
  REGIONES,
  REGIONES_ABIERTAS,
  REGIONES_PLEGADAS,
  anotarPais,
  nombreDePais,
  paisDe,
  paisDeCanal,
  paisDeTvgId,
  regionDe,
  regionDePais,
} from "./origenes";
import type { Channel } from "./types";

describe("paisDeCanal, con entradas reales de la lista por defecto", () => {
  it("«Canal 11 TuTV» es de El Salvador, como dice su tvg-id", () => {
    // La regla vieja de categories.ts lo daba por guatemalteco por el nombre.
    const pais = paisDeCanal({ nombre: "Canal 11 TuTV", tvgId: "Canal11TuTV.sv@SD" });
    expect(pais).toBe("sv");
    expect(regionDePais(pais)).toBe("centroamerica");
    expect(nombreDePais(pais)).toBe("El Salvador");
  });

  it("distingue el Canal 3 de Guatemala del de La Pampa", () => {
    expect(paisDeCanal({ nombre: "Canal 3", tvgId: "Canal3.gt@SD" })).toBe("gt");
    expect(paisDeCanal({ nombre: "Canal 3 La Pampa", tvgId: "Canal3LaPampa.ar@SD" })).toBe("ar");
    expect(paisDeCanal({ nombre: "Canal 3 Biar", tvgId: "Canal3TVBiar.es@SD" })).toBe("es");
  });

  it("tvg-country manda sobre el tvg-id, venga como venga", () => {
    expect(paisDeCanal({ nombre: "X", tvgCountry: "HN", tvgId: "X.us@SD" })).toBe("hn");
    expect(paisDeCanal({ nombre: "X", tvgCountry: "gt;us" })).toBe("gt");
    expect(paisDeCanal({ nombre: "X", tvgCountry: "Guatemala" })).toBe("gt");
    expect(paisDeCanal({ nombre: "X", tvgCountry: "México" })).toBe("mx");
  });

  it("sin país en la lista, solo las señales inequívocas de Guatemala", () => {
    expect(paisDeCanal({ nombre: "Guatevision" })).toBe("gt");
    expect(paisDeCanal({ nombre: "TN23" })).toBe("gt");
    expect(paisDeCanal({ nombre: "Canal 7" })).toBe("gt");
    // Ni el nombre en español ni un «Canal 3» con apellido bastan.
    expect(paisDeCanal({ nombre: "Canal 3 La Pampa" })).toBe("");
    expect(paisDeCanal({ nombre: "Telemundo" })).toBe("");
  });

  it("lee el sufijo del tvg-id con y sin calidad", () => {
    expect(paisDeTvgId("00sReplay.us@SD")).toBe("us");
    expect(paisDeTvgId("HCH.hn")).toBe("hn");
    expect(paisDeTvgId("SinPais")).toBe("");
  });
});

describe("regiones", () => {
  it("reparte por idioma y cercanía, no por el mapa", () => {
    expect(regionDePais("gt")).toBe("guatemala");
    expect(regionDePais("hn")).toBe("centroamerica");
    expect(regionDePais("bz")).toBe("centroamerica");
    expect(regionDePais("mx")).toBe("mexico");
    expect(regionDePais("do")).toBe("caribe");
    expect(regionDePais("pr")).toBe("caribe");
    // Jamaica es Caribe en el mapa, pero la sección existe por el idioma.
    expect(regionDePais("jm")).toBe("mundo");
    expect(regionDePais("ar")).toBe("sudamerica");
    // Brasil no habla español: al resto del mundo.
    expect(regionDePais("br")).toBe("mundo");
    expect(regionDePais("es")).toBe("espana");
    expect(regionDePais("us")).toBe("eeuu");
    expect(regionDePais("")).toBe("sin-pais");
  });

  it("abiertas y plegadas cubren todas las regiones, una vez", () => {
    expect([...REGIONES_ABIERTAS, ...REGIONES_PLEGADAS]).toEqual([...REGIONES]);
  });

  it("nombra los países en español y no revienta con un código raro", () => {
    expect(nombreDePais("hn")).toBe("Honduras");
    expect(nombreDePais("do")).toBe("República Dominicana");
    expect(nombreDePais("")).toBe("");
    expect(nombreDePais("zz")).toBe("ZZ");
  });
});

describe("el país sin campo en Channel", () => {
  const canal = (): Channel => ({
    id: 1,
    name: "HCH",
    number: "1201",
    category: "Noticias",
    logoUrl: "",
    streamUrl: "https://s.test/hch.m3u8",
  });

  it("se apunta al desempaquetar y se lee después", () => {
    const hch = canal();
    expect(paisDe(hch)).toBe("");
    anotarPais(hch, "hn");
    expect(paisDe(hch)).toBe("hn");
    expect(regionDe(hch)).toBe("centroamerica");
  });

  it("no añade ninguna clave al objeto: no viaja ni se serializa", () => {
    const hch = canal();
    anotarPais(hch, "hn");
    expect(Object.keys(hch)).toEqual(Object.keys(canal()));
  });
});
