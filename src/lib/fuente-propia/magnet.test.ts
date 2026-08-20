import { describe, expect, it } from "vitest";
import { avisoDeMagnet, esMagnet, fuenteReproducible, leerMagnet } from "./magnet";

const HASH = "c9e15763f722f23e98a29decdfae341b98d53056";

describe("esMagnet", () => {
  it("reconoce un magnet aunque venga con espacios alrededor", () => {
    expect(esMagnet(`  magnet:?xt=urn:btih:${HASH}  `)).toBe(true);
    expect(esMagnet(`MAGNET:?xt=urn:btih:${HASH}`)).toBe(true);
  });

  it("no confunde un enlace normal que mencione la palabra", () => {
    expect(esMagnet("https://ejemplo.com/magnet.mp4")).toBe(false);
    expect(esMagnet("")).toBe(false);
  });
});

describe("leerMagnet", () => {
  it("saca hash, nombre, rastreadores y réplicas", () => {
    const leido = leerMagnet(
      `magnet:?xt=urn:btih:${HASH}&dn=Mi+Pelicula&tr=udp%3A%2F%2Ftracker.uno%3A80` +
        `&tr=udp%3A%2F%2Ftracker.dos%3A80&ws=https%3A%2F%2Fcdn.ejemplo.com%2Fpeli.mp4`,
    );
    expect(leido).not.toBeNull();
    expect(leido!.infohash).toBe(HASH);
    expect(leido!.nombre).toBe("Mi Pelicula");
    expect(leido!.rastreadores).toHaveLength(2);
    expect(leido!.replicasHttp).toEqual(["https://cdn.ejemplo.com/peli.mp4"]);
  });

  it("acepta el infohash en base32, que es como lo escriben algunos sitios", () => {
    const b32 = "zdqvo3xxelzd5gfct3wn7lrud4mnkmcw";
    expect(leerMagnet(`magnet:?xt=urn:btih:${b32}`)?.infohash).toBe(b32);
  });

  it("normaliza el hash a minúsculas para poder compararlos", () => {
    expect(leerMagnet(`magnet:?xt=urn:btih:${HASH.toUpperCase()}`)?.infohash).toBe(HASH);
  });

  it("devuelve null si no hay infohash utilizable", () => {
    expect(leerMagnet("magnet:?dn=Solo+Un+Nombre")).toBeNull();
    expect(leerMagnet(`magnet:?xt=urn:btih:demasiado-corto`)).toBeNull();
    expect(leerMagnet("https://ejemplo.com/v.mp4")).toBeNull();
  });

  it("acepta `as` como sinónimo antiguo de `ws`", () => {
    const leido = leerMagnet(
      `magnet:?xt=urn:btih:${HASH}&as=https%3A%2F%2Farchivo.org%2Fv.mp4`,
    );
    expect(leido!.replicasHttp).toEqual(["https://archivo.org/v.mp4"]);
  });

  it("descarta réplicas que no se puedan pedir por HTTP", () => {
    const leido = leerMagnet(`magnet:?xt=urn:btih:${HASH}&ws=ftp%3A%2F%2Fviejo%2Fv.mp4`);
    expect(leido!.replicasHttp).toEqual([]);
  });
});

describe("fuenteReproducible", () => {
  it("da la réplica cuando existe", () => {
    const leido = leerMagnet(`magnet:?xt=urn:btih:${HASH}&ws=https%3A%2F%2Fa.com%2Fv.mp4`)!;
    expect(fuenteReproducible(leido)).toBe("https://a.com/v.mp4");
    expect(avisoDeMagnet(leido)).toContain("se reproduce directamente");
  });

  it("da null y explica el porqué cuando no la hay", () => {
    const leido = leerMagnet(`magnet:?xt=urn:btih:${HASH}&dn=Algo`)!;
    expect(fuenteReproducible(leido)).toBeNull();
    // El aviso tiene que decir el motivo, no solo que no se puede.
    expect(avisoDeMagnet(leido)).toContain("BitTorrent");
  });
});
