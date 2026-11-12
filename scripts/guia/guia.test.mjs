import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { aXml, canalesConProgramas, elegirCanales, idsDeLaLista, leerCanalesDeSitio } from "./armar-canales.mjs";
import { MINIMO_PROGRAMAS, juntar } from "./juntar-guias.mjs";

const require = createRequire(import.meta.url);
const gatotv = require("./gatotv.com.canalcasa.config.cjs");

const LISTA = `#EXTM3U
#EXTINF:-1 tvg-id="Canal7.gt@SD",Canal 7
https://x/7.m3u8
#EXTINF:-1 tvg-id="TN23.gt@SD",TN23
https://x/23.m3u8
#EXTINF:-1 tvg-id="LasEstrellas.mx@SD",Las Estrellas
https://x/e.m3u8
#EXTINF:-1 tvg-id="BBCNews.uk@SD",BBC News
https://x/b.m3u8
#EXTINF:-1 tvg-id="Cops.us@SD",Cops
https://x/c.m3u8
`;

const SITIOS = [
  ...leerCanalesDeSitio(`<channels>
  <channel site="gatotv.com" site_id="7_de_guatemala" lang="es" xmltv_id="Televisiete.gt@SD">Canal 7 de Guatemala</channel>
  <channel site="gatotv.com" site_id="las_estrellas" lang="es" xmltv_id="LasEstrellas.mx@SD">Las Estrellas</channel>
  <channel site="i.mjh.nz" site_id="Plex/us#1" lang="en" xmltv_id="BBCNews.uk@SD">BBC News</channel>
  <channel site="i.mjh.nz" site_id="Plex/us#2" lang="es" xmltv_id="Cops.us@SD">Cops</channel>
  <channel site="pluto.tv" site_id="cops" lang="es" xmltv_id="Cops.us@SD">Cops &amp; más</channel>
</channels>`),
];

describe("armar-canales", () => {
  const ids = idsDeLaLista(LISTA);

  it("empareja por tvg-id, deja fuera lo que no se ve en casa y usa el id de la lista", () => {
    const canales = elegirCanales(ids, SITIOS);
    const porId = Object.fromEntries(canales.map((c) => [c.tvgId, c]));
    // Las Estrellas: México, por GatoTV con la hora arreglada.
    expect(porId["LasEstrellas.mx@SD"].site).toBe("gatotv.com.canalcasa");
    // BBC News: en inglés y de fuera: no entra.
    expect(porId["BBCNews.uk@SD"]).toBeUndefined();
    // Cops: dos sitios; manda el preferido (pluto.tv antes que i.mjh.nz).
    expect(porId["Cops.us@SD"].site).toBe("pluto.tv");
    expect(porId["Cops.us@SD"].nombre).toBe("Cops & más");
  });

  it("los manuales mandan: Canal 7 por mi.tv aunque GatoTV lo llame Televisiete", () => {
    const canales = elegirCanales(ids, SITIOS);
    const siete = canales.find((c) => c.tvgId === "Canal7.gt@SD");
    expect(siete).toMatchObject({ site: "mi.tv", siteId: "gt#televisiete" });
    expect(canales.find((c) => c.tvgId === "TN23.gt@SD")).toMatchObject({ site: "gatotv.com.canalcasa", siteId: "tn23" });
    // Lo de Guatemala va primero, por si el tope corta.
    expect(canales[0].tvgId.toLowerCase()).toContain(".gt");
  });

  it("la siguiente ronda da a los vacíos otro sitio, y nada a los que ya tienen", () => {
    const intentados = new Map([
      ["cops.us", new Set(["pluto.tv"])],
      ["lasestrellas.mx", new Set(["gatotv.com.canalcasa"])],
    ]);
    const conProgramas = new Set(["lasestrellas.mx"]);
    const ronda = elegirCanales(ids, SITIOS, { intentados, conProgramas });
    expect(ronda).toEqual([expect.objectContaining({ tvgId: "Cops.us@SD", site: "i.mjh.nz" })]);
    // Sin más sitios que probar, la ronda sale vacía.
    intentados.get("cops.us").add("i.mjh.nz");
    expect(elegirCanales(ids, SITIOS, { intentados, conProgramas })).toEqual([]);
  });

  it("escribe un channels.xml válido y escapado", () => {
    const xml = aXml([{ site: "mi.tv", siteId: "gt#a&b", lang: "es", tvgId: "X.gt@SD", nombre: "A & B" }]);
    expect(xml).toContain('site_id="gt#a&amp;b"');
    expect(xml).toContain(">A &amp; B</channel>");
    expect(leerCanalesDeSitio(xml)[0]).toMatchObject({ siteId: "gt#a&b", nombre: "A & B" });
  });

  it("sabe qué canales trajeron programas", () => {
    const guia = `<programme start="1" stop="2" channel="Cops.us@SD"><title>x</title></programme>`;
    expect([...canalesConProgramas(guia)]).toEqual(["cops.us"]);
  });
});

describe("juntar-guias", () => {
  const programa = (canal, titulo) => `<programme start="20261112070000 +0000" stop="20261112080000 +0000" channel="${canal}"><title>${titulo}</title></programme>`;

  it("un canal sale una vez: manda la primera ronda que le trajo programas", () => {
    const uno = `<tv><channel id="A"><display-name>A</display-name></channel><channel id="B"><display-name>B</display-name></channel>${programa("A", "de la uno")}</tv>`;
    const dos = `<tv><channel id="A"><display-name>A</display-name></channel><channel id="B"><display-name>B</display-name></channel>${programa("A", "repetido")}${programa("B", "de la dos")}</tv>`;
    const { xml, canales, programas } = juntar([uno, dos]);
    expect(canales).toBe(2);
    expect(programas).toBe(2);
    expect(xml).toContain("de la uno");
    expect(xml).toContain("de la dos");
    expect(xml).not.toContain("repetido");
  });

  it("tiene un mínimo para no publicar una guía vacía", () => {
    expect(MINIMO_PROGRAMAS).toBeGreaterThan(100);
    expect(juntar([]).programas).toBe(0);
  });
});

describe("GatoTV con la hora arreglada", () => {
  it("lee el desfase de la página y corrige lo que iptv-org lee como hora de Nueva York", () => {
    expect(gatotv.desfaseDeLaPagina("utc: true,\nutcOffset: -6\n")).toBe(-6 * 3600_000);
    // Leído a -5, emitido a -6: una hora más tarde en UTC.
    expect(gatotv.correccionMs("utcOffset: -6")).toBe(3600_000);
    expect(gatotv.correccionMs("utcOffset: -5")).toBe(0);
    expect(gatotv.correccionMs("sin dato")).toBe(0);
  });

  it("envuelve el lector de iptv-org sin cambiar lo demás", () => {
    const hora = (ms) => ({ ms, add: (n) => hora(ms + n) });
    const base = { site: "gatotv.com", days: 2, url: () => "u", parser: () => [{ title: "Telediario", start: hora(0), stop: hora(10) }] };
    const envuelto = gatotv.crear(base);
    expect(envuelto.site).toBe("gatotv.com.canalcasa");
    expect(envuelto.url()).toBe("u");
    const [p] = envuelto.parser({ content: "utcOffset: -6" });
    expect(p.title).toBe("Telediario");
    expect(p.start.ms).toBe(3600_000);
    expect(p.stop.ms).toBe(3600_000 + 10);
  });
});
