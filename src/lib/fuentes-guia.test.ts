import { describe, expect, it } from "vitest";
import { GUIAS_DE_RESPALDO, GUIA_DIARIA, fuentesDeGuia } from "./fuentes-guia";

describe("fuentesDeGuia", () => {
  it("sin EPG_URL: la diaria, la de la lista (sin fiarse) y después las de respaldo", () => {
    expect(fuentesDeGuia("", "https://lista.example/guia.xml.gz")).toEqual([
      { url: GUIA_DIARIA, deLaLista: false },
      { url: "https://lista.example/guia.xml.gz", deLaLista: true },
      ...GUIAS_DE_RESPALDO.map((url) => ({ url, deLaLista: false })),
    ]);
    expect(fuentesDeGuia("", null)).toEqual([GUIA_DIARIA, ...GUIAS_DE_RESPALDO].map((url) => ({ url, deLaLista: false })));
  });

  it("con EPG_URL manda solo eso, y admite varias separadas por comas", () => {
    expect(fuentesDeGuia(" https://a.example/a.xml , https://b.example/b.xml ", "https://lista.example/x")).toEqual([
      { url: "https://a.example/a.xml", deLaLista: false },
      { url: "https://b.example/b.xml", deLaLista: false },
    ]);
  });

  it("no pide dos veces la misma si la lista ya apunta a una de respaldo", () => {
    const fuentes = fuentesDeGuia("", GUIAS_DE_RESPALDO[0]);
    expect(fuentes.filter((f) => f.url === GUIAS_DE_RESPALDO[0])).toHaveLength(1);
  });

  it("«no» apaga la guía, incluida la de la lista", () => {
    expect(fuentesDeGuia(" NO ", "https://lista.example/x")).toEqual([]);
  });

  it("solo https", () => {
    for (const url of [GUIA_DIARIA, ...GUIAS_DE_RESPALDO]) expect(url.startsWith("https://")).toBe(true);
  });
});
