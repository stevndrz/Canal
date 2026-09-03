import { describe, expect, it } from "vitest";
import { accionDeTecla, TECLAS_A_REGISTRAR } from "./teclas-mando";

describe("accionDeTecla", () => {
  it("reconoce las teclas por nombre, que es lo que manda un navegador moderno", () => {
    expect(accionDeTecla({ key: "MediaPlayPause" })).toBe("reproducir");
    expect(accionDeTecla({ key: "MediaStop" })).toBe("parar");
    expect(accionDeTecla({ key: "ChannelUp" })).toBe("canal-arriba");
    expect(accionDeTecla({ key: "ChannelDown" })).toBe("canal-abajo");
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
