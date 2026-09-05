import { describe, expect, it } from "vitest";
import {
  claseDeEmision,
  configArranqueParaCalidad,
  fijarCalidad,
  nivelMaxParaCalidad,
  resolverCalidad,
} from "./motor";

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

describe("resolverCalidad", () => {
  it("respeta el selector nuevo cuando existe", () => {
    expect(resolverCalidad("720p", true)).toBe("720p");
    expect(resolverCalidad("auto", false)).toBe("auto");
  });

  it("traduce el booleano viejo para los ajustes ya guardados", () => {
    expect(resolverCalidad(undefined, true)).toBe("1080p");
    expect(resolverCalidad(undefined, false)).toBe("auto");
    expect(resolverCalidad(undefined, undefined)).toBe("auto");
  });

  it("un auto relleno por defecto con máxima vieja es intención vieja", () => {
    expect(resolverCalidad("auto", true)).toBe("1080p");
  });
});

describe("configArranqueParaCalidad", () => {
  it("auto mantiene el ABR clásico", () => {
    expect(configArranqueParaCalidad("auto")).toMatchObject({
      startLevel: -1,
      capLevelToPlayerSize: true,
    });
  });

  it("un escalón arranca arriba y suelta el tope por tamaño", () => {
    for (const calidad of ["480p", "720p", "1080p"] as const) {
      expect(configArranqueParaCalidad(calidad)).toMatchObject({
        capLevelToPlayerSize: false,
      });
    }
  });
});

describe("nivelMaxParaCalidad", () => {
  it("auto no limita nunca", () => {
    expect(nivelMaxParaCalidad([240, 480, 720, 1080], "auto")).toBe(-1);
  });

  it("acepta lo que no supere el tope aunque no sea exacto", () => {
    // 576p entra en el escalón 720p: por ancho saldría mal clasificado.
    expect(nivelMaxParaCalidad([240, 480, 576, 720, 1080], "720p")).toBe(3);
    expect(nivelMaxParaCalidad([240, 480, 720, 1080], "480p")).toBe(1);
  });

  it("si todo supera el tope, se queda con lo más bajo en vez de nada", () => {
    expect(nivelMaxParaCalidad([1080, 2160], "480p")).toBe(0);
  });
});

describe("fijarCalidad", () => {
  it("baja el nivel actual cuando se queda fuera", () => {
    const hls = { levels: [{ height: 480 }, { height: 720 }, { height: 1080 }], currentLevel: 2 };
    fijarCalidad(hls, "480p");
    expect(hls.currentLevel).toBe(0);
  });

  it("auto suelta el tope (-1) en vez de fijar un nivel", () => {
    const hls = { levels: [{ height: 480 }, { height: 720 }], nextLevel: 0 };
    fijarCalidad(hls, "auto");
    expect(hls.nextLevel).toBe(-1);
  });

  it("sin niveles no revienta", () => {
    expect(() => fijarCalidad(null, "720p")).not.toThrow();
    expect(() => fijarCalidad({ levels: [] }, "720p")).not.toThrow();
  });
});
