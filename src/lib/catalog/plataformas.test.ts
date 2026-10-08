import { describe, expect, it } from "vitest";
import { consultaDePlataforma, elegirLogo, plataformaValida, plataformasDeLaRegion } from "./plataformas";

describe("plataformas de la región", () => {
  it("se queda con las conocidas, en su orden y sin repetir Max", () => {
    const tmdb = [
      { provider_id: 350, provider_name: "Apple TV Plus", logo_path: "/apple.jpg" },
      { provider_id: 9999, provider_name: "Rara", logo_path: "/rara.jpg" },
      { provider_id: 384, provider_name: "HBO Max", logo_path: "/hbo.jpg" },
      { provider_id: 8, provider_name: "Netflix", logo_path: "/netflix.jpg" },
      { provider_id: 1899, provider_name: "Max", logo_path: "/max.jpg" },
      { provider_id: 337, provider_name: "Disney Plus", logo_path: null },
    ];
    expect(plataformasDeLaRegion(tmdb).map((p) => p.nombre)).toEqual(["Netflix", "Max", "Apple TV+"]);
    expect(plataformasDeLaRegion(tmdb).find((p) => p.nombre === "Max")?.logo).toBe("/max.jpg");
  });

  it("solo acepta en la URL ids de la lista", () => {
    expect(plataformaValida("8")).toBe(8);
    expect(plataformaValida("9999")).toBeNull();
    expect(plataformaValida("abc")).toBeNull();
    expect(plataformaValida(undefined)).toBeNull();
  });

  it("filtra por suscripción en Guatemala", () => {
    expect(consultaDePlataforma(8)).toBe("&with_watch_providers=8&watch_region=GT&with_watch_monetization_types=flatrate|free|ads");
    expect(consultaDePlataforma(null)).toBe("");
  });
});

describe("logo del título", () => {
  it("prefiere el de español, y entre ellos el más votado", () => {
    expect(
      elegirLogo([
        { file_path: "/en.png", iso_639_1: "en", vote_average: 9 },
        { file_path: "/es-malo.png", iso_639_1: "es", vote_average: 2 },
        { file_path: "/es.png", iso_639_1: "es", vote_average: 5 },
        { file_path: "/nada.png", iso_639_1: null, vote_average: 8 },
      ]),
    ).toBe("/es.png");
  });

  it("sin español, uno sin idioma; en otro idioma, ninguno", () => {
    expect(elegirLogo([{ file_path: "/nada.png", iso_639_1: null }, { file_path: "/en.png", iso_639_1: "en" }])).toBe("/nada.png");
    expect(elegirLogo([{ file_path: "/en.png", iso_639_1: "en" }])).toBeNull();
    expect(elegirLogo(undefined)).toBeNull();
  });
});
