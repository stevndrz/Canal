import { describe, expect, it } from "vitest";
import { getEpgEntry, parseXmltv } from "./epg";

/** Una guía mínima pero realista, con las rarezas que traen las de verdad. */
const GUIA = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="Canal3.gt">
    <display-name>Canal 3</display-name>
    <display-name>Canal Tres</display-name>
  </channel>
  <channel id="Canal7.gt">
    <display-name>Canal 7 HD</display-name>
  </channel>
  <channel><display-name>Sin id</display-name></channel>

  <programme channel="Canal3.gt" start="20260821180000 -0600" stop="20260821190000 -0600">
    <title>Noticiero</title>
  </programme>
  <programme channel="Canal3.gt" start="20260821190000 -0600" stop="20260821200000 -0600">
    <title>Pel&#237;cula de la noche</title>
  </programme>
  <programme channel="Canal7.gt" start="20260821180000" stop="20260821190000">
    <title>Moralejas</title>
  </programme>
  <programme channel="Canal3.gt" start="malo" stop="peor"><title>Descartado</title></programme>
  <programme channel="Canal3.gt" start="20260821200000 -0600" stop="20260821210000 -0600"></programme>
</tv>`;

const guia = parseXmltv(GUIA);

/** 21 ago 2026, 18:30 en Guatemala (UTC-6) = 00:30 UTC del 22. */
const DURANTE_NOTICIERO = Date.UTC(2026, 7, 22, 0, 30);

describe("parseXmltv", () => {
  it("indexa los canales por nombre normalizado", () => {
    // Los dos `display-name` del mismo canal apuntan al mismo id.
    expect(guia.idByName.get("canal3")).toBe("Canal3.gt");
    expect(guia.idByName.get("canaltres")).toBe("Canal3.gt");
    // `HD` es sufijo de calidad y se descarta al normalizar.
    expect(guia.idByName.get("canal7")).toBe("Canal7.gt");
  });

  it("descarta un canal sin id en vez de romper la pasada", () => {
    expect(guia.idByName.get("sinid")).toBeUndefined();
    // Y los que sí tienen id siguen ahí: la pasada no se detuvo.
    expect(guia.idByName.size).toBe(3);
  });

  it("descarta programas incompletos", () => {
    const programas = guia.programmesByChannel.get("canal3.gt") ?? [];
    // Cuatro `<programme>` de Canal 3, pero uno tiene fechas inválidas y otro
    // no tiene título: quedan dos.
    expect(programas).toHaveLength(2);
    expect(programas.map((p) => p.title)).toEqual(["Noticiero", "Película de la noche"]);
  });

  it("decodifica las entidades XML del título", () => {
    const programas = guia.programmesByChannel.get("canal3.gt") ?? [];
    expect(programas[1].title).toBe("Película de la noche");
  });

  it("aplica el desfase horario, y sin él interpreta UTC", () => {
    const conDesfase = guia.programmesByChannel.get("canal3.gt")![0];
    const sinDesfase = guia.programmesByChannel.get("canal7.gt")![0];
    // 18:00 en UTC-6 son las 00:00 UTC del día siguiente.
    expect(conDesfase.start).toBe(Date.UTC(2026, 7, 22, 0, 0, 0));
    // Sin desfase, 18:00 son las 18:00 UTC del mismo día.
    expect(sinDesfase.start).toBe(Date.UTC(2026, 7, 21, 18, 0, 0));
  });
});

describe("getEpgEntry", () => {
  it("encuentra el programa actual y el siguiente por id", () => {
    const entrada = getEpgEntry(guia, "Canal3.gt", "", DURANTE_NOTICIERO);
    expect(entrada?.current?.title).toBe("Noticiero");
    expect(entrada?.next?.title).toBe("Película de la noche");
  });

  it("ignora el sufijo de señal del id, que la guía no publica", () => {
    // Las listas estilo iptv-org escriben `Canal3.gt@SD`.
    const entrada = getEpgEntry(guia, "Canal3.gt@SD", "", DURANTE_NOTICIERO);
    expect(entrada?.current?.title).toBe("Noticiero");
  });

  it("cae al nombre cuando no hay tvg-id, que es lo habitual", () => {
    const entrada = getEpgEntry(guia, "", "Canal 3", DURANTE_NOTICIERO);
    expect(entrada?.current?.title).toBe("Noticiero");
  });

  it("empareja aunque el nombre traiga sufijo de calidad o paréntesis", () => {
    expect(getEpgEntry(guia, "", "Canal 7 HD", Date.UTC(2026, 7, 21, 18, 30))?.current?.title)
      .toBe("Moralejas");
    expect(getEpgEntry(guia, "", "Canal 3 (Guatemala)", DURANTE_NOTICIERO)?.current?.title)
      .toBe("Noticiero");
  });

  it("devuelve null cuando el canal no está en la guía", () => {
    expect(getEpgEntry(guia, "NoExiste", "Tampoco", DURANTE_NOTICIERO)).toBeNull();
  });

  it("da solo `next` cuando aún no ha empezado nada", () => {
    const antes = Date.UTC(2026, 7, 21, 12, 0);
    const entrada = getEpgEntry(guia, "Canal3.gt", "", antes);
    expect(entrada?.current).toBeNull();
    expect(entrada?.next?.title).toBe("Noticiero");
  });

  it("devuelve null cuando ya terminó todo", () => {
    const despues = Date.UTC(2027, 0, 1);
    expect(getEpgEntry(guia, "Canal3.gt", "", despues)).toBeNull();
  });
});
