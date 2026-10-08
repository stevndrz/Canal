import { describe, expect, it } from "vitest";
import { channelNameVariants, normalizeChannelName, normalizeText } from "./text";

describe("normalizeText", () => {
  it("quita acentos y baja a minúsculas conservando el resto", () => {
    expect(normalizeText("Canal Guatemaltéco (HD)")).toBe("canal guatemalteco (hd)");
    expect(normalizeText("ÑOÑO")).toBe("nono");
  });
});

describe("normalizeChannelName", () => {
  it("empareja el mismo canal escrito de dos formas", () => {
    // El caso real: la lista M3U dice una cosa y la guía XMLTV otra.
    expect(normalizeChannelName("Canal 3 HD")).toBe(normalizeChannelName("canal-3"));
    expect(normalizeChannelName("TV Azteca 4K")).toBe(normalizeChannelName("tv azteca"));
  });

  it("descarta los sufijos de calidad como palabra suelta, no dentro de otra", () => {
    expect(normalizeChannelName("Canal HD")).toBe("canal");
    // "Hdez" no es un sufijo de calidad: se conserva entero.
    expect(normalizeChannelName("Hdez TV")).toBe("hdeztv");
  });

  it("conserva letras y números de alfabetos no latinos", () => {
    expect(normalizeChannelName("НТВ")).toBe("нтв");
    expect(normalizeChannelName("日本 5")).toBe("日本5");
  });

  it("se queda vacío si no había ni letras ni números", () => {
    expect(normalizeChannelName("--- ///")).toBe("");
  });
});

describe("channelNameVariants", () => {
  it("añade la forma sin paréntesis finales, de más específica a más general", () => {
    expect(channelNameVariants("Canal 3 (Guatemala)")).toEqual(["Canal 3 (Guatemala)", "Canal 3"]);
  });

  it("no duplica cuando no hay nada que quitar", () => {
    expect(channelNameVariants("Canal 3")).toEqual(["Canal 3"]);
  });
});

describe("camino rápido de normalización (teles viejas)", () => {
  // Las versiones directas de antes, para comparar: mismo resultado exacto.
  const textoDirecto = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const nombreDirecto = (v: string) =>
    Array.from(textoDirecto(v).replace(/\b(hd|fhd|uhd|4k|sd)\b/g, " "))
      .filter((c) => /\p{L}|\p{N}/u.test(c))
      .join("");

  const casos = [
    "Canal 7", "Guatevisión HD", "TN23 (FHD)", "ESPN 2 UHD", "Ñandú TV", "Télé Québec",
    "餘姚姚江文化", "Канал 1", "قناة الجزيرة", "a^b`c", "MTV 4K", "  Sky-Sports_News  ",
    "Ελληνικά", "Ｆｕｌｌ ｗｉｄｔｈ", "naïve café", "",
  ];

  it("da lo mismo que la versión directa, con y sin acentos y en otros alfabetos", () => {
    for (const caso of casos) {
      expect(normalizeText(caso)).toBe(textoDirecto(caso));
      expect(normalizeChannelName(caso)).toBe(nombreDirecto(caso));
    }
  });

  it("da lo mismo para todo el ASCII imprimible", () => {
    let todo = "";
    for (let i = 32; i < 127; i++) todo += String.fromCharCode(i);
    expect(normalizeText(todo)).toBe(textoDirecto(todo));
    expect(normalizeChannelName(todo)).toBe(nombreDirecto(todo));
  });
});
