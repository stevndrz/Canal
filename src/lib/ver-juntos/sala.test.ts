import { describe, expect, it } from "vitest";
import {
  CANAL_DE_SALA,
  LARGO_CODIGO,
  canalDeSala,
  crearCodigoSala,
  leerMensaje,
  normalizarCodigo,
} from "./sala";
import { firmarCanal } from "./firma";

describe("códigos de sala", () => {
  it("salen del largo justo y sin letras confusas", () => {
    for (let i = 0; i < 200; i++) {
      const codigo = crearCodigoSala();
      expect(codigo).toHaveLength(LARGO_CODIGO);
      expect(codigo).not.toMatch(/[01ilo]/);
      expect(normalizarCodigo(codigo)).toBe(codigo);
      expect(CANAL_DE_SALA.test(canalDeSala(codigo))).toBe(true);
    }
  });

  it("descarta los bytes que sesgarían el reparto", () => {
    // 248 en adelante se rechaza (256 − 256 % 31); 0 es la primera letra.
    const codigo = crearCodigoSala((n) => new Uint8Array(n).map((_, i) => (i % 2 ? 0 : 250)));
    expect(codigo).toBe("222222");
  });

  it("tolera lo que pasa al teclear, y rechaza lo que no es un código", () => {
    expect(normalizarCodigo(" K7M-2QX ")).toBe("k7m2qx");
    expect(normalizarCodigo("k7m 2qx")).toBe("k7m2qx");
    expect(normalizarCodigo("k7m2q")).toBe("");
    expect(normalizarCodigo("k7m2q0")).toBe("");
    expect(normalizarCodigo("../../x")).toBe("");
  });

  it("la firma solo acepta canales de sala", () => {
    expect(CANAL_DE_SALA.test("private-juntos-k7m2qx")).toBe(true);
    expect(CANAL_DE_SALA.test("private-otra-cosa")).toBe(false);
    expect(CANAL_DE_SALA.test("private-juntos-k7m2qx-extra")).toBe(false);
    expect(CANAL_DE_SALA.test("presence-juntos-k7m2qx")).toBe(false);
  });
});

describe("mensajes de la sala", () => {
  it("acepta los tres tipos bien formados", () => {
    expect(leerMensaje({ tipo: "hola" })).toEqual({ tipo: "hola" });
    expect(leerMensaje({ tipo: "estado", tiempo: 12.5, pausado: true })).toEqual({
      tipo: "estado",
      tiempo: 12.5,
      pausado: true,
      pulso: false,
    });
    expect(
      leerMensaje({ tipo: "video", video: { url: "https://cubo.example/peli/master.m3u8", titulo: "Peli" } }),
    ).toEqual({ tipo: "video", video: { url: "https://cubo.example/peli/master.m3u8", titulo: "Peli" } });
  });

  it("ignora lo mal formado", () => {
    expect(leerMensaje(null)).toBeNull();
    expect(leerMensaje("hola")).toBeNull();
    expect(leerMensaje({ tipo: "estado", tiempo: -1, pausado: true })).toBeNull();
    expect(leerMensaje({ tipo: "estado", tiempo: Number.NaN, pausado: true })).toBeNull();
    expect(leerMensaje({ tipo: "estado", tiempo: 3 })).toBeNull();
    expect(leerMensaje({ tipo: "otro" })).toBeNull();
  });

  it("no deja colar un vídeo que no sea http(s)", () => {
    expect(leerMensaje({ tipo: "video", video: { url: "javascript:alert(1)", titulo: "x" } })).toBeNull();
    expect(leerMensaje({ tipo: "video", video: { url: "file:///etc/passwd" } })).toBeNull();
  });
});

describe("firma de Pusher", () => {
  it("coincide con el ejemplo de la documentación de Pusher", () => {
    // pusher.com/docs/channels/library_auth_reference/auth-signatures
    expect(firmarCanal("7ad3773142a6692b25b8", "1234.1234", "private-foobar")).toBe(
      "58df8b0c36d6982b82c3ecf6b4662e34fe8c25bba48f5369f135bf843651c3a4",
    );
  });
});
