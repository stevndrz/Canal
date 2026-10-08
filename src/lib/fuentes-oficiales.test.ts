import { describe, expect, it } from "vitest";
import { fuenteOficial } from "./fuentes-oficiales";
import { parseM3uChannels } from "./m3u";

const LISTA = `#EXTM3U
#EXTINF:-1 tvg-id="Canal7.gt@SD" group-title="General",Canal 7
https://d1zq2gydd8y59v.cloudfront.net/ts:abr.m3u8
#EXTINF:-1 tvg-id="Canal7.gt@SD" group-title="General",Canal 7 HD
http://181.119.177.253:8000/play/a03n/index.m3u8
#EXTINF:-1 tvg-id="Canal3LaPampa.ar@SD" group-title="General",Canal 3 La Pampa
https://stream.arcast.com.ar/c3lapampa/ngrp:c3lapampa_all/playlist.m3u8
`;

describe("fuentes oficiales", () => {
  it("reconoce el tvg-id con o sin calidad y sin mirar mayúsculas", () => {
    expect(fuenteOficial("Canal7.gt@SD")).toBe(fuenteOficial("canal7.GT"));
    expect(fuenteOficial("Canal3.gt@HD")?.principal).toContain("/live/i8bocdjcqa5r/");
    expect(fuenteOficial("Canal3LaPampa.ar@SD")).toBeUndefined();
    expect(fuenteOficial("")).toBeUndefined();
  });

  it("pisa la URL de la lista y su respaldo, y no toca al homónimo de otro país", () => {
    const canales = parseM3uChannels(LISTA);
    const siete = canales.find((c) => c.name === "Canal 7");
    expect(siete?.streamUrl).toBe("https://ddycmnicl95kp.cloudfront.net/live/hm8maie2jnn2/master.m3u8");
    expect(siete?.streamUrlBackup).toBe("https://d6qmllupbc5d2.cloudfront.net/hls/hm8maie2jnn2/index.m3u8");
    const pampa = canales.find((c) => c.name === "Canal 3 La Pampa");
    expect(pampa?.streamUrl).toContain("arcast.com.ar");
  });
});
