import { describe, expect, it } from "vitest";
import { extensionDe } from "./extension";
import { claseDeEmision } from "./reproduccion/motor";
import { claseDeUrl } from "./fuente-propia/url";

describe("extensionDe", () => {
  it("recorta la consulta: los enlaces firmados la llevan siempre", () => {
    // Es el caso que rompía una de las tres copias: sin recortar, la extensión
    // era `mp4?token=…` y no coincidía con nada.
    expect(extensionDe("https://a.test/peli.mp4?token=abc&e=43200")).toBe("mp4");
  });

  it("recorta el ancla", () => {
    expect(extensionDe("https://a.test/canal.m3u8#t=10")).toBe("m3u8");
  });

  it("no confunde un punto del dominio con una extensión", () => {
    expect(extensionDe("https://cdn.ejemplo.com/canal")).toBe("");
  });

  it("una URL sin extensión no devuelve basura", () => {
    expect(extensionDe("https://a.test/live/123/")).toBe("");
  });

  it("no le importan las mayúsculas", () => {
    expect(extensionDe("https://a.test/PELI.MP4")).toBe("mp4");
  });
});

/**
 * Las dos clasificaciones tienen vocabularios distintos a propósito, pero
 * **coinciden en qué familia es cada extensión**. Esa correspondencia estaba
 * escrita en un comentario que decía «si un día cambia una, tiene que cambiar
 * la otra», y ese comentario ya se había quedado obsoleto una vez: nombraba una
 * función (`getStreamKind`) que hacía tiempo que no existía.
 *
 * Aquí queda comprobado en vez de pedido.
 */
describe("los dos vocabularios siguen de acuerdo", () => {
  const EQUIVALENCIAS = [
    { ext: "m3u8", emision: "hls", fuente: "hls" },
    { ext: "ts", emision: "mpegts", fuente: "mpegts" },
    { ext: "flv", emision: "flv", fuente: "mpegts" },
    { ext: "mp4", emision: "native", fuente: "nativo" },
    { ext: "webm", emision: "native", fuente: "nativo" },
    { ext: "mov", emision: "native", fuente: "nativo" },
  ] as const;

  it.each(EQUIVALENCIAS)("$ext: $emision / $fuente", ({ ext, emision, fuente }) => {
    const url = `https://a.test/algo.${ext}`;
    expect(claseDeEmision(url)).toBe(emision);
    expect(claseDeUrl(url)).toBe(fuente);
  });

  it("`.mkv` diverge, y es correcto que diverja", () => {
    const url = "https://a.test/algo.mkv";
    // Al `<video>` se le puede dar y a veces funciona...
    expect(claseDeEmision(url)).toBe("native");
    // ...pero a quien pega el enlace hay que avisarle de que casi nunca va.
    expect(claseDeUrl(url)).toBe("matroska");
  });

  it("lo desconocido diverge, y también es correcto", () => {
    const url = "https://a.test/live/123";
    // Una lista M3U emite HLS aunque la URL no lo diga: es la apuesta correcta.
    expect(claseDeEmision(url)).toBe("hls");
    // Un enlace pegado a mano no: ahí se dice que no se reconoce y se avisa.
    expect(claseDeUrl(url)).toBe("desconocida");
  });
});
