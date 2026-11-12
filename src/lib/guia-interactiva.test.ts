import { describe, expect, it } from "vitest";
import {
  bloquesDeFila,
  filasDeGuia,
  franjaPara,
  horasDeGuia,
  indiceEn,
  inicioDeVentana,
  moverCursor,
  textoRestante,
} from "./guia-interactiva";

const M = 60_000;
/** 12 nov 2026, 20:00 UTC: una media hora en punto. */
const D = Date.UTC(2026, 10, 12, 20, 0);
const AHORA = D + 10 * M;

// 20:00–21:00 Noticiero · 21:00–21:30 Novela · 21:30–23:00 Película
const PROGRAMAS = [
  { titulo: "Noticiero", inicio: D, fin: D + 60 * M },
  { titulo: "Novela", inicio: D + 60 * M, fin: D + 90 * M },
  { titulo: "Película", inicio: D + 90 * M, fin: D + 180 * M },
];

describe("guía interactiva", () => {
  const bloques = bloquesDeFila(PROGRAMAS, D, 2);

  it("encuentra el programa del cursor", () => {
    expect(bloques[indiceEn(bloques, AHORA, D)].titulo).toBe("Noticiero");
    expect(bloques[indiceEn(bloques, D + 75 * M, D)].titulo).toBe("Novela");
  });

  it("→ va al principio del siguiente y ← vuelve, sin pasar de ahora", () => {
    const novela = moverCursor(bloques, AHORA, 1, D, AHORA);
    expect(novela).toBe(D + 60 * M);
    const pelicula = moverCursor(bloques, novela, 1, D, AHORA);
    expect(pelicula).toBe(D + 90 * M);
    expect(moverCursor(bloques, pelicula, -1, D, AHORA)).toBe(D + 60 * M);
    // Desde la novela, ← vuelve al programa en emisión, no a su inicio pasado.
    expect(moverCursor(bloques, novela, -1, D, AHORA)).toBe(AHORA);
    expect(moverCursor(bloques, AHORA, -1, D, AHORA)).toBe(AHORA);
  });

  it("un canal sin guía se recorre de media hora en media hora", () => {
    const vacia = bloquesDeFila([], D, 2);
    expect(vacia).toHaveLength(1);
    expect(vacia[0].hueco).toBe(true);
    expect(moverCursor(vacia, AHORA, 1, D, AHORA)).toBe(D + 30 * M);
    expect(moverCursor(vacia, D + 60 * M, -1, D, AHORA)).toBe(D + 30 * M);
  });

  it("la franja solo se mueve cuando el cursor se sale", () => {
    expect(franjaPara(D, D + 90 * M, 2)).toBe(D);
    expect(franjaPara(D, D + 130 * M, 2)).toBe(D + 120 * M);
    expect(franjaPara(D + 120 * M, D + 100 * M, 2)).toBe(D + 90 * M);
  });

  it("la ventana deja el foco a un tercio y no se sale de la lista", () => {
    expect(inicioDeVentana(4, 3, 6)).toBe(0);
    expect(inicioDeVentana(100, 0, 6)).toBe(0);
    expect(inicioDeVentana(100, 50, 6)).toBe(49);
    expect(inicioDeVentana(100, 99, 6)).toBe(94);
  });

  it("se adapta a la pantalla", () => {
    expect(horasDeGuia(390)).toBe(1);
    expect(horasDeGuia(1920)).toBe(2);
    expect(filasDeGuia(1920, 1080)).toBe(6);
    expect(filasDeGuia(390, 844)).toBe(5);
    expect(filasDeGuia(844, 390)).toBe(3);
  });

  it("dice lo que queda como una guía", () => {
    expect(textoRestante(D + 60 * M, AHORA)).toBe("Quedan 50 min");
    expect(textoRestante(D + 89 * M, D + 10 * M)).toBe("Quedan 1 h 19 min");
    expect(textoRestante(D + 120 * M, D)).toBe("Quedan 2 h");
  });
});
