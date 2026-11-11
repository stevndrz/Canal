import { describe, expect, it } from "vitest";
import { destinoDeSalto, metadatosDe, posicionDe } from "./sesion-medios";

describe("metadatosDe", () => {
  it("título y carátula para la pantalla de bloqueo", () => {
    expect(metadatosDe(" Coco ", "https://image.tmdb.org/t/p/w780/x.jpg")).toEqual({
      title: "Coco",
      artist: "CanalCasa",
      artwork: [{ src: "https://image.tmdb.org/t/p/w780/x.jpg" }],
    });
  });

  it("sin carátula, o con algo que no es una dirección web, no manda imagen", () => {
    expect(metadatosDe("Coco").artwork).toEqual([]);
    expect(metadatosDe("Coco", "javascript:alert(1)").artwork).toEqual([]);
    expect(metadatosDe("", null).title).toBe("CanalCasa");
  });
});

describe("posicionDe", () => {
  it("la posición, dentro de la duración", () => {
    expect(posicionDe(6300, 2830, 1)).toEqual({ duration: 6300, position: 2830, playbackRate: 1 });
    expect(posicionDe(100, 140, 1.5)).toEqual({ duration: 100, position: 100, playbackRate: 1.5 });
    expect(posicionDe(100, -3, 0)).toEqual({ duration: 100, position: 0, playbackRate: 1 });
  });

  it("sin duración conocida no se dice nada (el navegador lanzaría)", () => {
    for (const d of [NaN, Infinity, 0, -1]) expect(posicionDe(d, 10, 1)).toBeNull();
    expect(posicionDe(100, NaN, 1)).toBeNull();
  });
});

describe("destinoDeSalto", () => {
  it("no se sale de la película por ningún extremo", () => {
    expect(destinoDeSalto(50, 100, 10)).toBe(60);
    expect(destinoDeSalto(5, 100, -10)).toBe(0);
    expect(destinoDeSalto(95, 100, 10)).toBe(100);
    expect(destinoDeSalto(95, NaN, 10)).toBe(105);
  });
});
