import { describe, expect, it } from "vitest";
import { cambioDeSalud } from "./salud-de-la-emision";

const sano = { streamError: false, isPlaying: true };
const parado = { streamError: false, isPlaying: false };
const roto = { streamError: true, isPlaying: false };

describe("cambioDeSalud", () => {
  it("**un canal que sigue roto no vuelve a avisar**", () => {
    // Este es EL fallo que motivó la función. Escrito como condición sobre el
    // estado actual, un canal caído avisaba en cada render: cada aviso escribía
    // en localStorage y reordenaba 7.822 canales.
    expect(cambioDeSalud(roto, roto)).toBeNull();
    expect(cambioDeSalud(roto, { streamError: true, isPlaying: true })).toBeNull();
  });

  it("avisa en el flanco de caída, una sola vez", () => {
    expect(cambioDeSalud(sano, roto)).toBe("cayo");
    expect(cambioDeSalud(parado, roto)).toBe("cayo");
  });

  it("avisa cuando el canal vuelve a dar imagen", () => {
    expect(cambioDeSalud(parado, sano)).toBe("revivio");
    expect(cambioDeSalud(roto, sano)).toBe("revivio");
  });

  it("volver del error sin imagen todavía no es revivir", () => {
    expect(cambioDeSalud(roto, parado)).toBeNull();
  });

  it("reproducir sin parar no es noticia ninguna", () => {
    expect(cambioDeSalud(sano, sano)).toBeNull();
    expect(cambioDeSalud(parado, parado)).toBeNull();
  });

  it("sin lectura previa solo se cuenta el error", () => {
    // Que un canal esté sonando al montarse es lo normal, no una noticia; que
    // arranque roto sí lo es.
    expect(cambioDeSalud(undefined, sano)).toBeNull();
    expect(cambioDeSalud(undefined, roto)).toBe("cayo");
  });
});
