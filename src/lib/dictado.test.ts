import { describe, expect, it } from "vitest";
import { IDIOMA, hayDictado, limpiarDictado, mensajeDeError, motorDeDictado } from "./dictado";

/** Un navegador que sí puede dictar. */
const COMPLETO = { webkitSpeechRecognition: function () {}, mediaDevices: {} };

describe("hayDictado", () => {
  it("hace falta el motor **y** el micrófono al alcance", () => {
    expect(hayDictado(COMPLETO)).toBe(true);
  });

  it("sin motor no se puede, por mucho micrófono que haya", () => {
    // El caso de casi cualquier navegador de televisor.
    expect(hayDictado({ mediaDevices: {} })).toBe(false);
  });

  it("con motor pero sin `mediaDevices` tampoco", () => {
    // Página servida por http: en la red de casa. El botón saldría para no
    // hacer nada, que es lo que de verdad parece roto.
    expect(hayDictado({ webkitSpeechRecognition: function () {} })).toBe(false);
  });

  it("sin entorno —render de servidor— no se puede", () => {
    expect(hayDictado(undefined)).toBe(false);
  });
});

describe("motorDeDictado", () => {
  it("el estándar gana al de WebKit", () => {
    const estandar = function () {};
    const webkit = function () {};
    expect(
      motorDeDictado({ SpeechRecognition: estandar, webkitSpeechRecognition: webkit, mediaDevices: {} }),
    ).toBe(estandar);
  });

  it("devuelve nada cuando no se puede, en vez de algo inservible", () => {
    expect(motorDeDictado({ webkitSpeechRecognition: function () {} })).toBeNull();
  });
});

describe("limpiarDictado", () => {
  it("quita el punto final, que estropea la búsqueda en TMDB", () => {
    expect(limpiarDictado("Guardianes de la galaxia.")).toBe("Guardianes de la galaxia");
  });

  it("quita los signos de apertura y los espacios de más", () => {
    expect(limpiarDictado("  ¿dónde está  el canal 3?  ")).toBe("dónde está el canal 3?");
  });

  it("**no toca la puntuación de dentro**: hay títulos que la llevan", () => {
    expect(limpiarDictado("Dr. Who")).toBe("Dr. Who");
    expect(limpiarDictado("Spider-Man")).toBe("Spider-Man");
  });

  it("aguanta una cadena vacía", () => {
    expect(limpiarDictado("   ")).toBe("");
  });
});

describe("mensajeDeError", () => {
  it("distingue «no te oí» de «no me dejas oírte»", () => {
    // Una se arregla repitiendo; la otra hay que ir a los ajustes.
    expect(mensajeDeError("no-speech")).toContain("otra vez");
    expect(mensajeDeError("not-allowed")).toContain("permiso");
  });

  it("cancelar no es un error que merezca aviso", () => {
    expect(mensajeDeError("aborted")).toBe("");
  });

  it("un código desconocido no se enseña en crudo", () => {
    const mensaje = mensajeDeError("algo-que-no-existe");
    expect(mensaje).not.toContain("algo-que-no-existe");
    expect(mensaje).toContain("teclado");
  });
});

describe("idioma", () => {
  it("es el español de Latinoamérica, que es donde se usa esto", () => {
    expect(IDIOMA).toBe("es-419");
  });
});
