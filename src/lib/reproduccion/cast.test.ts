import { describe, expect, it } from "vitest";
import {
  describirErrorCast,
  esCancelacion,
  esHls,
  formatoHls,
  tipoDeContenido,
} from "./cast";

describe("tipoDeContenido", () => {
  it("distingue DASH de HLS: mandar x-mpegurl para un MPD lo rechaza el receptor", () => {
    expect(tipoDeContenido("https://x.test/live.mpd")).toBe("application/dash+xml");
    expect(tipoDeContenido("https://x.test/live.m3u8")).toBe("application/x-mpegurl");
  });

  it("reconoce los archivos sueltos de una peli", () => {
    expect(tipoDeContenido("https://x.test/peli.mp4")).toBe("video/mp4");
    expect(tipoDeContenido("https://x.test/peli.webm")).toBe("video/webm");
  });

  it("ignora la cadena de consulta al mirar la extensión", () => {
    expect(tipoDeContenido("https://x.test/live.mpd?token=abc")).toBe("application/dash+xml");
    expect(tipoDeContenido("https://x.test/peli.mp4?firma=1&t=2")).toBe("video/mp4");
  });

  it("asume HLS cuando no hay extensión: es lo que traen casi todas las listas IPTV", () => {
    expect(tipoDeContenido("https://x.test/LiveApp/streams/CqwAgRag")).toBe(
      "application/x-mpegurl",
    );
    // Caso real de la lista: la extensión va precedida de dos puntos.
    expect(tipoDeContenido("https://x.cloudfront.net/ts:abr.m3u8")).toBe("application/x-mpegurl");
  });
});

describe("formatoHls", () => {
  it("declara TS, que es lo que usan las listas IPTV y lo que el receptor no adivina", () => {
    expect(formatoHls()).toEqual({ segmento: "ts", video: "mpeg2_ts" });
  });

  it("prefiere los enums del SDK cuando existen", () => {
    expect(formatoHls({ TS: "TS_ENUM" }, { MPEG2_TS: "MPEG2_ENUM" })).toEqual({
      segmento: "TS_ENUM",
      video: "MPEG2_ENUM",
    });
  });

  it("solo se declara para HLS: un MP4 o un MPD no lo llevan", () => {
    expect(esHls(tipoDeContenido("https://x.test/a.m3u8"))).toBe(true);
    expect(esHls(tipoDeContenido("https://x.test/a.mp4"))).toBe(false);
    expect(esHls(tipoDeContenido("https://x.test/a.mpd"))).toBe(false);
  });
});

describe("esCancelacion", () => {
  it("cerrar el selector no es un fallo que avisar", () => {
    expect(esCancelacion({ code: "cancel" })).toBe(true);
    expect(esCancelacion({ code: "CANCEL" })).toBe(true);
  });

  it("un fallo de carga sí lo es", () => {
    expect(esCancelacion({ code: "load_failed" })).toBe(false);
    expect(esCancelacion(null)).toBe(false);
  });
});

describe("describirErrorCast", () => {
  it("lleva el código dentro del mensaje: en una tele no hay consola que abrir", () => {
    const mensaje = describirErrorCast({ code: "load_failed" });
    expect(mensaje).toContain("load_failed");
    expect(mensaje).toContain("no pudo abrir");
  });

  it("suma la descripción del SDK cuando viene", () => {
    expect(describirErrorCast({ code: "timeout", description: "sin respuesta" })).toContain(
      "timeout · sin respuesta",
    );
  });

  it("distingue los fallos, porque no se arreglan igual", () => {
    expect(describirErrorCast({ code: "session_error" })).toContain("Se perdió la conexión");
    expect(describirErrorCast({ code: "channel_error" })).toContain("misma red");
  });

  it("no deja paréntesis vacíos cuando no hay código", () => {
    expect(describirErrorCast(null)).toBe("No se pudo transmitir a esa pantalla.");
  });
});
