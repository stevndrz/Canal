import { describe, expect, it } from "vitest";
import { nombreDeGenero, traducirGeneros } from "./generos";

describe("géneros en español", () => {
  it("traduce por id los géneros de series que TMDB deja en inglés", () => {
    expect(nombreDeGenero("tv", 10759, "Action & Adventure")).toBe("Acción y aventura");
    expect(nombreDeGenero("tv", 10762, "Kids")).toBe("Infantil");
    expect(nombreDeGenero("tv", 10763, "News")).toBe("Noticias");
    expect(nombreDeGenero("tv", 10764, "Reality")).toBe("Telerrealidad");
    expect(nombreDeGenero("tv", 10765, "Sci-Fi & Fantasy")).toBe("Ciencia ficción y fantasía");
    expect(nombreDeGenero("tv", 10766, "Soap")).toBe("Telenovela");
    expect(nombreDeGenero("tv", 10767, "Talk")).toBe("Programas de entrevistas");
    expect(nombreDeGenero("tv", 10768, "War & Politics")).toBe("Bélica y política");
  });

  it("respeta el nombre de TMDB cuando ya viene bien o el id es nuevo", () => {
    expect(nombreDeGenero("tv", 18, "Drama")).toBe("Drama");
    expect(nombreDeGenero("tv", 99999, "Género nuevo")).toBe("Género nuevo");
  });

  it("no toca las películas, que TMDB ya traduce", () => {
    expect(nombreDeGenero("movie", 10759, "Lo que diga TMDB")).toBe("Lo que diga TMDB");
  });

  it("traduce una lista entera conservando el resto de campos", () => {
    const lista = traducirGeneros("tv", [
      { id: 10766, name: "Soap", extra: 1 },
      { id: 35, name: "Comedia", extra: 2 },
    ]);
    expect(lista).toEqual([
      { id: 10766, name: "Telenovela", extra: 1 },
      { id: 35, name: "Comedia", extra: 2 },
    ]);
  });
});
