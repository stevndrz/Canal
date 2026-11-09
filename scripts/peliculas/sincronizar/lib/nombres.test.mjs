import { describe, expect, it } from "vitest";
import { infoSubtitulo, slug, tituloDelNombre } from "./nombres.mjs";

describe("tituloDelNombre", () => {
  it.each([
    ["The.Hunger.Games.Catching.Fire.2013.1080p.BluRay.x264-SPARKS.mkv", "The Hunger Games Catching Fire", 2013],
    ["Interstellar (2014) [1080p] [YTS.MX].mp4", "Interstellar", 2014],
    ["Coco 2017 Latino 1080p WEB-DL.mkv", "Coco", 2017],
    ["Mi pelicula favorita.mkv", "Mi pelicula favorita", null],
    ["2012.2009.1080p.mkv", "2012", 2009],
    ["Spider-Man.No.Way.Home.2021.2160p.HDR.mkv", "Spider-Man No Way Home", 2021],
    ["the-hunger-games-catching-fire.mkv", "the-hunger-games-catching-fire", null],
  ])("%s", (nombre, titulo, anio) => {
    expect(tituloDelNombre(nombre)).toEqual({ titulo, anio });
  });
});

describe("slug", () => {
  it("sin acentos ni signos", () => {
    expect(slug("The Hunger Games: Catching Fire")).toBe("the-hunger-games-catching-fire");
    expect(slug("Érase una vez… ¡México!")).toBe("erase-una-vez-mexico");
    expect(slug("!!!")).toBe("pelicula");
  });
});

describe("infoSubtitulo", () => {
  it.each([
    ["Catching.Fire.2013.Spanish.Latino.srt", "spa", "es", "Español latino", false],
    ["pelicula.es.forced.srt", "spa", "es", "Español (forzados)", true],
    ["Interstellar.2014.English [SDH].srt", "eng", "en", "Inglés (SDH)", false],
    ["Interstellar.en.srt", "eng", "en", "Inglés", false],
    ["subtitulos.srt", "spa", "es", "Español", false],
    ["Coco.pt.vtt", "por", "pt", "Portugués", false],
  ])("%s", (nombre, idioma, srclang, etiqueta, forzados) => {
    expect(infoSubtitulo(nombre)).toEqual({ idioma, srclang, etiqueta, forzados });
  });
});
