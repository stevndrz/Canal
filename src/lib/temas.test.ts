import { describe, expect, it } from "vitest";
import {
  TEMAS,
  TEMAS_CON_CHIP,
  TEMAS_DE_MAS,
  claveDeTema,
  ordenDeTema,
  temaDeCanal,
  temaDeClave,
  temaDeGrupo,
  temaPorNombre,
} from "./temas";

describe("temaDeGrupo: lo que dice la lista manda", () => {
  it("entiende el group-title de iptv-org", () => {
    expect(temaDeGrupo("News")).toBe("Noticias");
    expect(temaDeGrupo("Weather")).toBe("Noticias");
    expect(temaDeGrupo("Sports")).toBe("Deportes");
    expect(temaDeGrupo("Kids")).toBe("Infantil");
    expect(temaDeGrupo("Animation")).toBe("Infantil");
    expect(temaDeGrupo("Movies")).toBe("Películas y series");
    expect(temaDeGrupo("Classic")).toBe("Películas y series");
    expect(temaDeGrupo("Education")).toBe("Documentales");
    expect(temaDeGrupo("Music")).toBe("Música");
    expect(temaDeGrupo("Religious")).toBe("Religión");
    expect(temaDeGrupo("Lifestyle")).toBe("Variedades");
    expect(temaDeGrupo("Shop")).toBe("Compras");
    expect(temaDeGrupo("General")).toBe("Generalista");
  });

  it("los canales públicos y legislativos ya no son Noticias", () => {
    // 122 entraban en Noticias solo por «public|legislative» en el nombre o el
    // grupo, como «3Cat Càmeres». Son otra cosa, y van aparte.
    expect(temaDeGrupo("Legislative")).toBe("Institucional");
    expect(temaDeGrupo("Public")).toBe("Institucional");
  });

  it("con varios temas gana el primero del orden de la tabla, no el de la cadena", () => {
    expect(temaDeGrupo("Kids;Religious")).toBe("Infantil");
    expect(temaDeGrupo("Religious;Kids")).toBe("Infantil");
    expect(temaDeGrupo("General;News")).toBe("Generalista");
    expect(temaDeGrupo("Entertainment;Sports")).toBe("Deportes");
    expect(temaDeGrupo("Culture;News")).toBe("Noticias");
    expect(temaDeGrupo("Music;Religious")).toBe("Música");
  });

  it("también entiende una lista hecha a mano, en español", () => {
    expect(temaDeGrupo("Deportes")).toBe("Deportes");
    expect(temaDeGrupo("Noticias")).toBe("Noticias");
    expect(temaDeGrupo("Películas")).toBe("Películas y series");
    expect(temaDeGrupo("Niños")).toBe("Infantil");
  });

  it("lo que no es un tema no se inventa: Undefined, vacío o un país", () => {
    expect(temaDeGrupo("Undefined")).toBeNull();
    expect(temaDeGrupo("")).toBeNull();
    // «Guatemala» en group-title dice de dónde es, no de qué va.
    expect(temaDeGrupo("Guatemala")).toBeNull();
    expect(temaDeGrupo("Latino")).toBeNull();
  });
});

describe("temaPorNombre: el respaldo", () => {
  it("reconoce lo evidente por el nombre", () => {
    expect(temaPorNombre("ESPN Deportes")).toBe("Deportes");
    expect(temaPorNombre("TUDN")).toBe("Deportes");
    expect(temaPorNombre("Cartoon Network")).toBe("Infantil");
    expect(temaPorNombre("CNN en Español")).toBe("Noticias");
  });

  it("BBC ya no es sinónimo de noticias", () => {
    // La categoría Noticias la abrían 13 BBC de entretenimiento.
    expect(temaPorNombre("BBC Comedy")).toBe("Variedades");
    expect(temaPorNombre("BBC Drama")).not.toBe("Noticias");
  });

  it("el idioma no es un tema: lo que no se reconoce es «Otros», no «Internacional»", () => {
    expect(temaPorNombre("Canal Latino Spanish")).toBe("Otros");
    expect(temaPorNombre("zzz 9999")).toBe("Otros");
  });
});

describe("temaDeCanal", () => {
  it("prefiere la lista al nombre", () => {
    // El nombre diría Deportes; la lista dice que es un generalista.
    expect(temaDeCanal({ nombre: "Canal Deportes Uno", grupo: "General" })).toBe("Generalista");
  });

  it("cae al nombre cuando la lista no dice nada", () => {
    expect(temaDeCanal({ nombre: "Fox Sports", grupo: "Undefined" })).toBe("Deportes");
    expect(temaDeCanal({ nombre: "Canal 100 Chinique" })).toBe("Otros");
  });
});

describe("las tablas", () => {
  it("cada tema está en un chip o detrás de «Más», y en uno solo", () => {
    const repartidos = [...TEMAS_CON_CHIP, ...TEMAS_DE_MAS];
    expect(new Set(repartidos).size).toBe(repartidos.length);
    expect([...repartidos].sort()).toEqual([...TEMAS].sort());
  });

  it("ordena los generalistas primero y lo desconocido al final", () => {
    expect(ordenDeTema("Generalista")).toBe(0);
    expect(ordenDeTema("Noticias")).toBeLessThan(ordenDeTema("Religión"));
    expect(ordenDeTema("Inventado")).toBe(TEMAS.length);
  });

  it("la clave de la URL va y vuelve", () => {
    for (const tema of TEMAS) expect(temaDeClave(claveDeTema(tema))).toBe(tema);
    expect(claveDeTema("Películas y series")).toBe("peliculas-y-series");
    expect(temaDeClave("nada")).toBeNull();
  });
});
