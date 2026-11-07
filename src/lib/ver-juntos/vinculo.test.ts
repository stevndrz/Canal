import { describe, expect, it } from "vitest";
import { canalDeLaSala, emitirLlave, leerLlave, limpiarNombre, pinCorrecto, salaConfigurada } from "./vinculo";

const SECRETO = "s".repeat(40);
const config = { pin: "4821", secreto: SECRETO };

describe("salaConfigurada", () => {
  it("exige PIN de cuatro cifras y un secreto largo", () => {
    expect(salaConfigurada({ salaPin: "4821", salaSecreto: SECRETO })).toEqual(config);
    expect(salaConfigurada({ salaPin: "482", salaSecreto: SECRETO })).toBeNull();
    expect(salaConfigurada({ salaPin: "48a1", salaSecreto: SECRETO })).toBeNull();
    expect(salaConfigurada({ salaPin: "4821", salaSecreto: "corto" })).toBeNull();
  });
});

describe("llaves", () => {
  it("una llave emitida se lee con su nombre e id", () => {
    const { llave, vinculo } = emitirLlave(config, "Tele sala");
    expect(leerLlave(config, llave)).toEqual(vinculo);
    expect(vinculo.nombre).toBe("Tele sala");
  });

  it("cambiar el PIN o el secreto invalida todas las llaves", () => {
    const { llave } = emitirLlave(config, "Steven");
    expect(leerLlave({ ...config, pin: "0000" }, llave)).toBeNull();
    expect(leerLlave({ ...config, secreto: "t".repeat(40) }, llave)).toBeNull();
  });

  it("no se puede cambiar el nombre de una llave sin romper la firma", () => {
    const { llave } = emitirLlave(config, "Steven");
    const [, firma] = llave.split(".");
    const falsa = `${Buffer.from(JSON.stringify({ v: 1, id: "x", nombre: "Otro" })).toString("base64url")}.${firma}`;
    expect(leerLlave(config, falsa)).toBeNull();
    expect(leerLlave(config, "basura")).toBeNull();
    expect(leerLlave(config, "")).toBeNull();
    expect(leerLlave(config, `${llave}.extra`)).toBeNull();
  });
});

describe("canal y PIN", () => {
  it("el canal sale del secreto y del PIN, y cambia con ellos", () => {
    const canal = canalDeLaSala(config);
    expect(canal).toMatch(/^presence-sala-[0-9a-f]{32}$/);
    expect(canalDeLaSala(config)).toBe(canal);
    expect(canalDeLaSala({ ...config, pin: "1111" })).not.toBe(canal);
  });

  it("compara el PIN", () => {
    expect(pinCorrecto(config, "4821")).toBe(true);
    expect(pinCorrecto(config, "4822")).toBe(false);
    expect(pinCorrecto(config, "")).toBe(false);
  });

  it("limpia el nombre del aparato", () => {
    expect(limpiarNombre("  Tele\n  sala  ")).toBe("Tele sala");
    expect(limpiarNombre("x".repeat(40))).toHaveLength(24);
    expect(limpiarNombre(42)).toBe("");
  });
});
