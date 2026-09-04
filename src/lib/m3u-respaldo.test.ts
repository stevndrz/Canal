import { describe, expect, it } from "vitest";
import { parseM3uChannels } from "./m3u";

const M3U_DUPLICADA = `#EXTM3U
#EXTINF:-1 tvg-id="ESPN.us" tvg-logo="https://logo.test/espn.png" group-title="Deportes",ESPN HD
https://origen-a.test/espn.m3u8
#EXTINF:-1 tvg-id="ESPN.us" tvg-logo="https://logo.test/espn.png" group-title="Deportes",ESPN FHD
https://origen-b.test/espn.m3u8
#EXTINF:-1 tvg-id="FOX.us" group-title="Deportes",FOX
https://origen-a.test/fox.m3u8
`;

describe("respaldo multi-fuente", () => {
  it("la misma señal con dos URLs sale una vez, con respaldo", () => {
    const canales = parseM3uChannels(M3U_DUPLICADA);
    expect(canales).toHaveLength(2);
    const espn = canales.find((c) => c.name === "ESPN");
    expect(espn?.streamUrl).toBe("https://origen-a.test/espn.m3u8");
    expect(espn?.streamUrlBackup).toBe("https://origen-b.test/espn.m3u8");
  });

  it("sin duplicado no hay clave de respaldo", () => {
    const canales = parseM3uChannels(M3U_DUPLICADA);
    const fox = canales.find((c) => c.name === "FOX");
    expect(fox && "streamUrlBackup" in fox).toBe(false);
  });
});
