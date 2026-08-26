import { describe, expect, it } from "vitest";
import { buildEmbedUrl, getProviders, ordenarParaTelevisor } from "./providers";
import { esTelevisorUA } from "@/lib/dispositivo";

describe("ordenarParaTelevisor", () => {
  it("manda al final a los que tienen puerta antirrobot, sin quitarlos", () => {
    const lista = [
      { id: "a", puertaAntirrobot: true },
      { id: "b", puertaAntirrobot: false },
      { id: "c", puertaAntirrobot: true },
      { id: "d", puertaAntirrobot: false },
    ];
    expect(ordenarParaTelevisor(lista).map((p) => p.id)).toEqual(["b", "d", "a", "c"]);
  });

  it("conserva el orden relativo dentro de cada grupo", () => {
    const lista = [
      { id: "1", puertaAntirrobot: false },
      { id: "2", puertaAntirrobot: false },
      { id: "3", puertaAntirrobot: false },
    ];
    expect(ordenarParaTelevisor(lista).map((p) => p.id)).toEqual(["1", "2", "3"]);
  });

  it("EL CASO REAL: en una serie, VidSrc deja de ser el primero en un televisor", () => {
    // Sin vimeus (no cubre series), VidSrc encabezaba la lista y su puerta de
    // Turnstile dejaba el marco recargándose para siempre en un Samsung.
    const paraSeries = getProviders().filter((p) =>
      buildEmbedUrl(p, "tv", { tmdbId: 123192, season: 1, episode: 1 }),
    );
    expect(paraSeries[0].id).toBe("vidsrc");

    const enTele = ordenarParaTelevisor(paraSeries);
    expect(enTele[0].id).not.toBe("vidsrc");
    expect(enTele[0].puertaAntirrobot).toBeFalsy();
    // Sigue estando disponible, solo que al final.
    expect(enTele.map((p) => p.id)).toContain("vidsrc");
    expect(enTele).toHaveLength(paraSeries.length);
  });
});

describe("esTelevisorUA", () => {
  it("reconoce los televisores del salón", () => {
    for (const ua of [
      "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 Chrome/76 Safari/537.36",
      "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/87 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 9; AFTKA Build/PS7233) AppleWebKit/537.36",
      "Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 Chrome/125 Safari/537.36 CrKey/1.56",
    ]) {
      expect(esTelevisorUA(ua), ua).toBe(true);
    }
  });

  it("no confunde un teléfono ni un ordenador con un televisor", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36",
    ]) {
      expect(esTelevisorUA(ua), ua).toBe(false);
    }
  });

  it("un User-Agent vacío no es un televisor", () => {
    expect(esTelevisorUA("")).toBe(false);
  });
});
