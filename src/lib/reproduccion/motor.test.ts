import { describe, expect, it } from "vitest";
import { claseDeEmision } from "./motor";

describe("claseDeEmision", () => {
  it("reconoce cada formato por su extensión", () => {
    expect(claseDeEmision("https://a.com/canal.m3u8")).toBe("hls");
    expect(claseDeEmision("https://a.com/canal.ts")).toBe("mpegts");
    expect(claseDeEmision("https://a.com/canal.flv")).toBe("flv");
    expect(claseDeEmision("https://a.com/peli.mp4")).toBe("native");
    expect(claseDeEmision("https://a.com/peli.mkv")).toBe("native");
  });

  it("cae en HLS cuando no reconoce nada", () => {
    // Es el formato dominante en listas IPTV públicas, y muchísimas URLs no
    // terminan en .m3u8 aunque lo sean.
    expect(claseDeEmision("https://a.com/stream/12345")).toBe("hls");
    expect(claseDeEmision("https://a.com/live")).toBe("hls");
  });

  it("ignora la cadena de consulta al mirar la extensión", () => {
    expect(claseDeEmision("https://a.com/c.ts?token=abc&e=99")).toBe("mpegts");
    expect(claseDeEmision("https://a.com/v.mp4?t=1")).toBe("native");
  });

  it("no se deja engañar por una extensión a media URL", () => {
    // `.ts` en medio del camino no es el formato del archivo final.
    expect(claseDeEmision("https://a.com/ts/canal")).toBe("hls");
  });

  it("coincide con `claseDeUrl` de Mi enlace en los casos compartidos", () => {
    // Las dos clasifican por extensión y tienen que estar de acuerdo: si un
    // día se separan, un mismo enlace se reproduciría distinto según por qué
    // pantalla haya entrado.
    expect(claseDeEmision("https://a.com/v.m3u8")).toBe("hls");
    expect(claseDeEmision("https://a.com/v.mp4")).toBe("native");
  });
});
