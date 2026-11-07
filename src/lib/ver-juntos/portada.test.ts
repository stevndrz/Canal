import { describe, expect, it } from "vitest";
import { arteDe, audiosDelMaster, duracionCorta } from "./portada";

describe("audiosDelMaster", () => {
  it("saca los nombres de las pistas de audio, sin repetir", () => {
    const master = [
      "#EXTM3U",
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="Inglés",LANGUAGE="en",DEFAULT=YES',
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="b",NAME="Inglés",LANGUAGE="en"',
      '#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="Español latino",LANGUAGE="es"',
      '#EXT-X-MEDIA:TYPE=SUBTITLES,GROUP-ID="s",NAME="Español",LANGUAGE="es"',
      "#EXT-X-STREAM-INF:BANDWIDTH=5000000,AUDIO=\"a\"",
      "v/index.m3u8",
    ].join("\r\n");
    expect(audiosDelMaster(master)).toEqual(["Inglés", "Español latino"]);
    expect(audiosDelMaster("#EXTM3U\n")).toEqual([]);
  });
});

describe("duracionCorta", () => {
  it("en horas y minutos", () => {
    expect(duracionCorta(7380)).toBe("2 h 3 min");
    expect(duracionCorta(2700)).toBe("45 min");
    expect(duracionCorta(undefined)).toBe("");
  });
});

describe("arteDe", () => {
  const r = (title: string, mediaType = "movie", n = 1) => ({
    title,
    mediaType,
    backdrop: `https://image.tmdb.org/t/p/w1280/f${n}.jpg`,
    poster: `https://image.tmdb.org/t/p/w500/p${n}.jpg`,
  });
  it("prefiere la película con el mismo título, sin fijarse en acentos ni signos", () => {
    const resultados = [r("Catching Fire", "tv", 1), r("Los juegos del hambre", "movie", 2), r("The Hunger Games: Catching Fire", "movie", 3)];
    expect(arteDe(resultados, "the hunger games catching fire")?.fondo).toContain("f3");
  });
  it("si no hay título exacto, la primera película; si no hay ninguna, nada", () => {
    expect(arteDe([r("Otra", "movie", 4)], "Coco")?.poster).toContain("p4");
    expect(arteDe([r("Coco", "tv")], "Coco")).toBeNull();
    expect(arteDe(null, "Coco")).toBeNull();
    expect(arteDe([{ title: "Coco", mediaType: "movie", backdrop: "javascript:x" }], "Coco")).toBeNull();
  });
});
