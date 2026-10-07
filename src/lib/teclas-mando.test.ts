import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accionDeTecla, TECLAS_A_REGISTRAR } from "./teclas-mando";

describe("accionDeTecla", () => {
  it("reconoce las teclas por nombre, que es lo que manda un navegador moderno", () => {
    expect(accionDeTecla({ key: "MediaPlayPause" })).toBe("reproducir");
    expect(accionDeTecla({ key: "MediaStop" })).toBe("parar");
    expect(accionDeTecla({ key: "ChannelUp" })).toBe("canal-arriba");
    expect(accionDeTecla({ key: "ChannelDown" })).toBe("canal-abajo");
    expect(accionDeTecla({ key: "AudioVolumeUp" })).toBe("subir-volumen");
    expect(accionDeTecla({ key: "VolumeUp" })).toBe("subir-volumen");
  });

  it("reconoce las teclas por código, que es como llegan en Tizen 4 y 5", () => {
    // El caso que motivó el módulo: el mando de un Samsung manda 10252 y
    // `event.key` viene vacío, así que mirar solo el nombre no veía nada.
    expect(accionDeTecla({ keyCode: 10252 })).toBe("reproducir");
    expect(accionDeTecla({ keyCode: 415 })).toBe("reproducir");
    expect(accionDeTecla({ keyCode: 19 })).toBe("reproducir");
    expect(accionDeTecla({ keyCode: 413 })).toBe("parar");
    expect(accionDeTecla({ keyCode: 427 })).toBe("canal-arriba");
    expect(accionDeTecla({ keyCode: 428 })).toBe("canal-abajo");
    expect(accionDeTecla({ keyCode: 175 })).toBe("subir-volumen");
    expect(accionDeTecla({ keyCode: 24 })).toBe("subir-volumen");
  });

  it("reconoce CH+/CH− de LG (33/34) e Info (457)", () => {
    expect(accionDeTecla({ key: "Unidentified", keyCode: 33 })).toBe("canal-arriba");
    expect(accionDeTecla({ key: "PageDown", keyCode: 34 })).toBe("canal-abajo");
    expect(accionDeTecla({ keyCode: 457 })).toBe("info");
    expect(accionDeTecla({ key: "Info" })).toBe("info");
  });

  it("pide a Tizen los números, Info y los botones de canal", () => {
    for (const tecla of ["0", "5", "9", "Info", "ChannelUp", "ChannelDown"]) {
      expect(TECLAS_A_REGISTRAR).toContain(tecla);
    }
  });

  it("con nombre desconocido cae al código, en vez de rendirse", () => {
    // Tizen manda literalmente "Unidentified" en las teclas de reproducción.
    expect(accionDeTecla({ key: "Unidentified", keyCode: 10252 })).toBe("reproducir");
  });

  it("deja pasar todo lo demás", () => {
    expect(accionDeTecla({ key: "ArrowUp", keyCode: 38 })).toBeNull();
    expect(accionDeTecla({ key: "Enter", keyCode: 13 })).toBeNull();
    expect(accionDeTecla({ key: "a" })).toBeNull();
    expect(accionDeTecla({})).toBeNull();
  });

  it("no reclama las teclas que el televisor ya entrega solo", () => {
    // Reclamar las flechas o Atrás con `registerKey` es la forma de romper la
    // navegación del sistema sin ganar nada: ya llegan.
    for (const prohibida of ["ArrowUp", "ArrowDown", "Enter", "Back", "Exit"]) {
      expect(TECLAS_A_REGISTRAR).not.toContain(prohibida);
    }
  });
});

describe("el cascarón de Tizen", () => {
  it("registra exactamente las mismas teclas que pide la app", () => {
    // La lista está duplicada a la fuerza: `registerKey` solo existe en la
    // página local del widget. Esta prueba es la que impide que se separen.
    const html = readFileSync("empaque/tizen/index.html", "utf8");
    const bloque = html.match(/var TECLAS = \[([\s\S]*?)\];/);
    expect(bloque).not.toBeNull();
    const delCascaron = [...bloque![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect([...delCascaron].sort()).toEqual([...TECLAS_A_REGISTRAR].sort());
  });
});
