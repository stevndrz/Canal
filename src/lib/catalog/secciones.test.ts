import { describe, expect, it, vi } from "vitest";
import { rutaDeTipo, seccionDeRuta } from "./secciones";

// `discover.ts` importa la capa de TMDB, que es solo de servidor.
vi.mock("./tmdb", () => ({}));
const { enlaceDeFila } = await import("./discover");

describe("secciones del catálogo", () => {
  it("cada ruta enciende su sección en la barra", () => {
    expect(seccionDeRuta("/peliculas")).toBe("peliculas");
    expect(seccionDeRuta("/series")).toBe("series");
    expect(seccionDeRuta("/anime")).toBe("anime");
    expect(seccionDeRuta("/")).toBeNull();
  });

  it("una ficha de serie marca Series aunque cuelgue de /peliculas", () => {
    expect(seccionDeRuta("/peliculas/tv/tmdb-1399")).toBe("series");
    expect(seccionDeRuta("/peliculas/movie/tmdb-603")).toBe("peliculas");
  });

  it("cada tipo vuelve a su sección", () => {
    expect(rutaDeTipo("movie")).toBe("/peliculas");
    expect(rutaDeTipo("tv")).toBe("/series");
  });

  it("el título de una fila lleva a la cuadrilla de su género, en su sección", () => {
    expect(enlaceDeFila({ mediaType: "movie", generoId: 28 })).toBe("/peliculas?genero=28");
    expect(enlaceDeFila({ mediaType: "tv" })).toBe("/series");
    // En Anime hay series y películas: el tipo va en la URL.
    expect(enlaceDeFila({ mediaType: "tv", generoId: 35, seccion: "anime" })).toBe("/anime?tipo=tv&genero=35");
    expect(enlaceDeFila({ mediaType: "movie", seccion: "anime" })).toBe("/anime?tipo=movie");
  });
});
