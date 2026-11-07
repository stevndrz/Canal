import { describe, expect, it } from "vitest";
import {
  CANAL_DE_SALA,
  canalDeSala,
  crearCodigoSala,
  leerMensaje,
  limpiarNombre,
  esMasNueva,
  masNueva,
  normalizarCodigo,
  quienDirige,
} from "./sala";
import { firmarCanal } from "./firma";

describe("códigos de sala", () => {
  it("son cuatro cifras, sin sesgo", () => {
    for (let i = 0; i < 50; i++) expect(crearCodigoSala()).toMatch(/^\d{4}$/);
    // 250-255 se descartan: sesgarían hacia 0-5.
    expect(crearCodigoSala(() => new Uint8Array([255, 250, 1, 2, 3, 4, 0, 0]))).toBe("1234");
  });
  it("toleran espacios y guiones, y rechazan lo demás", () => {
    expect(normalizarCodigo(" 48-21 ")).toBe("4821");
    expect(normalizarCodigo("482")).toBe("");
    expect(normalizarCodigo("48a1")).toBe("");
  });
  it("la firma solo acepta canales de sala", () => {
    expect(CANAL_DE_SALA.test(canalDeSala("4821"))).toBe(true);
    expect(CANAL_DE_SALA.test("presence-juntos-482")).toBe(false);
  });
  it("limpia el alias", () => {
    expect(limpiarNombre("  Tele\n  sala  ")).toBe("Tele sala");
    expect(limpiarNombre("x".repeat(40))).toHaveLength(24);
    expect(limpiarNombre(42)).toBe("");
  });
});

describe("la última película elegida manda", () => {
  const video = { url: "https://cubo.example/a.m3u8", titulo: "A" };
  it("gana la versión mayor y, a igualdad, el aparato mayor", () => {
    const vieja = { video, version: 3, por: "pc" };
    const nueva = { video, version: 4, por: "aa" };
    expect(masNueva(vieja, nueva)).toBe(nueva);
    expect(masNueva(nueva, vieja)).toBe(nueva);
    const empate = { video, version: 3, por: "tv" };
    expect(masNueva(vieja, empate)).toBe(empate);
    expect(masNueva(empate, vieja)).toBe(empate);
    expect(masNueva(null, vieja)).toBe(vieja);
    expect(masNueva(null, null)).toBeNull();
  });
});

describe("esMasNueva", () => {
  const video = { url: "https://x/a.m3u8", titulo: "A" };
  it("la misma película en otro objeto no es más nueva (si no, los aparatos se contestan sin fin)", () => {
    expect(esMasNueva({ video, version: 2, por: "pc" }, { video: { ...video }, version: 2, por: "pc" })).toBe(false);
  });
  it("por versión y, a igualdad, por autor", () => {
    expect(esMasNueva({ video, version: 3, por: "a" }, { video, version: 2, por: "z" })).toBe(true);
    expect(esMasNueva({ video, version: 2, por: "z" }, { video, version: 2, por: "a" })).toBe(true);
    expect(esMasNueva(null, { video, version: 1, por: "a" })).toBe(false);
    expect(esMasNueva({ video, version: 1, por: "a" }, null)).toBe(true);
  });
});

describe("quién dirige", () => {
  const p = { video: { url: "https://x/a.m3u8", titulo: "A" }, version: 1, por: "tv" };
  it("quien eligió la película, si está", () => {
    expect(quienDirige(p, ["pc", "tv"])).toBe("tv");
  });
  it("si no, quien llegó antes; y nadie si no hay nadie", () => {
    expect(quienDirige(p, ["pc", "movil"])).toBe("pc");
    expect(quienDirige(null, ["movil", "pc"])).toBe("movil");
    expect(quienDirige(null, [])).toBeNull();
  });
});

describe("mensajes de la sala", () => {
  it("acepta los tipos bien formados", () => {
    expect(leerMensaje({ tipo: "hola" })).toEqual({ tipo: "hola" });
    expect(leerMensaje({ tipo: "empezar" })).toEqual({ tipo: "empezar" });
    expect(leerMensaje({ tipo: "estado", tiempo: 12.5, pausado: true })).toEqual({
      tipo: "estado",
      tiempo: 12.5,
      pausado: true,
      pulso: false,
    });
    const pelicula = { video: { url: "https://cubo.example/peli/master.m3u8", titulo: "Peli" }, version: 2, por: "abc" };
    expect(leerMensaje({ tipo: "video", pelicula })).toEqual({ tipo: "video", pelicula });
    expect(leerMensaje({ tipo: "video", pelicula: { ...pelicula, version: 0 } })).toBeNull();
    expect(leerMensaje({ tipo: "video", pelicula: { ...pelicula, por: "" } })).toBeNull();
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
    const con = (url: string) => ({ tipo: "video", pelicula: { video: { url, titulo: "x" }, version: 1, por: "a" } });
    expect(leerMensaje(con("javascript:alert(1)"))).toBeNull();
    expect(leerMensaje(con("file:///etc/passwd"))).toBeNull();
  });
});

describe("firma de Pusher", () => {
  it("coincide con el ejemplo de la documentación de Pusher", () => {
    // pusher.com/docs/channels/library_auth_reference/auth-signatures
    expect(firmarCanal("7ad3773142a6692b25b8", "1234.1234", "private-foobar")).toBe(
      "58df8b0c36d6982b82c3ecf6b4662e34fe8c25bba48f5369f135bf843651c3a4",
    );
  });

  it("en presencia, firma también quién eres", () => {
    // La cadena es la de la documentación («socket:canal:channel_data»); el
    // valor, el que da `openssl dgst -sha256 -hmac` sobre ella. El hexadecimal
    // que trae la página (afaed36…) no sale de su propia cadena: se comprobó.
    const datos = '{"user_id":10,"user_info":{"name":"Mr. Channels"}}';
    expect(firmarCanal("7ad3773142a6692b25b8", "1234.1234", "presence-foobar", datos)).toBe(
      "31935e7d86dba64c2a90aed31fdc61869f9b22ba9d8863bba239c03ca481bc80",
    );
  });
});
