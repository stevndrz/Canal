import { describe, expect, it } from "vitest";
import { leerCatalogo, rutaCatalogo } from "./catalogo";
import { leerMensaje } from "./sala";

/** Lo que escribe `scripts/peliculas/subir-pelicula.ps1`. */
const DEL_SCRIPT = {
  version: 1,
  peliculas: [
    {
      id: "coco",
      titulo: "Coco",
      url: "https://pub-x.r2.dev/peliculas/coco/master.m3u8",
      subtitulos: [{ label: "Español", srclang: "es", url: "https://pub-x.r2.dev/peliculas/coco/sub0-spa.vtt" }],
      duracion: 6300,
      subida: "2026-11-06T20:00:00Z",
    },
    { id: "sin-subs", titulo: "Sin subtítulos", url: "https://pub-x.r2.dev/peliculas/sin-subs/master.m3u8", subtitulos: [] },
  ],
};

describe("catálogo de Nuestras películas", () => {
  it("lee lo que escribe el script de subida", () => {
    expect(leerCatalogo(DEL_SCRIPT)).toEqual([
      {
        id: "coco",
        titulo: "Coco",
        url: "https://pub-x.r2.dev/peliculas/coco/master.m3u8",
        subtitulos: [{ label: "Español", srclang: "es", url: "https://pub-x.r2.dev/peliculas/coco/sub0-spa.vtt" }],
        duracion: 6300,
      },
      {
        id: "sin-subs",
        titulo: "Sin subtítulos",
        url: "https://pub-x.r2.dev/peliculas/sin-subs/master.m3u8",
        subtitulos: [],
        duracion: undefined,
      },
    ]);
  });

  it("descarta lo que no podría reproducirse sin riesgo", () => {
    const peliculas = leerCatalogo({
      peliculas: [
        { id: "mala", url: "javascript:alert(1)" },
        { id: "", url: "https://x/a.m3u8" },
        { id: "buena", url: "https://x/b.m3u8", subtitulos: [{ url: "data:text/vtt,x" }, { url: "https://x/s.vtt" }] },
        { id: "buena", url: "https://x/repetida.m3u8" },
        "basura",
        null,
      ],
    });
    expect(peliculas.map((p) => p.id)).toEqual(["buena"]);
    expect(peliculas[0].subtitulos).toEqual([{ url: "https://x/s.vtt", label: "Subtítulos", srclang: "und" }]);
  });

  it("acepta la lista de un elemento escrita como objeto suelto (PowerShell 5.1)", () => {
    const peliculas = leerCatalogo({
      peliculas: { id: "una", url: "https://x/m.m3u8", subtitulos: { label: "Español", srclang: "es", url: "https://x/s.vtt" } },
    });
    expect(peliculas).toHaveLength(1);
    expect(peliculas[0].subtitulos).toEqual([{ label: "Español", srclang: "es", url: "https://x/s.vtt" }]);
  });

  it("aguanta un archivo que no es un catálogo", () => {
    expect(leerCatalogo(null)).toEqual([]);
    expect(leerCatalogo("hola")).toEqual([]);
    expect(leerCatalogo({ peliculas: "x" })).toEqual([]);
  });

  it("sabe dónde está el catálogo", () => {
    expect(rutaCatalogo("https://pub-x.r2.dev")).toBe("https://pub-x.r2.dev/peliculas/catalogo.json");
  });
});

describe("la sala lleva los subtítulos al invitado", () => {
  it("pasan los http(s) y se cae el resto", () => {
    expect(
      leerMensaje({
        tipo: "video",
        video: {
          url: "https://x/m.m3u8",
          titulo: "Coco",
          subtitulos: [
            { label: "Español", srclang: "es", url: "https://x/s.vtt" },
            { label: "Malo", srclang: "es", url: "javascript:x" },
          ],
        },
      }),
    ).toEqual({
      tipo: "video",
      video: { url: "https://x/m.m3u8", titulo: "Coco", subtitulos: [{ label: "Español", srclang: "es", url: "https://x/s.vtt" }] },
    });
  });
});
