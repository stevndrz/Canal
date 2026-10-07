import { describe, expect, it } from "vitest";
import { buscarCanales, indexarBusqueda, textoSinResultados } from "./buscar-canales";
import { desempaquetarCanales, empaquetarCanales, type CanalDeOrigen } from "./canales-empaquetados";

/** Un canal como lo deja `m3u.ts`, con su tema y su país aparte. */
function canal(name: string, tema: string, pais: string): CanalDeOrigen {
  return {
    name,
    category: pais === "gt" ? "Guatemala" : "Internacional",
    logoUrl: "",
    streamUrl: `https://stream.test/${encodeURIComponent(name)}.m3u8`,
    tema,
    pais,
  };
}

/**
 * Una lista pequeña con lo que hace daño en la de verdad: un canal chino al
 * principio (la búsqueda vieja respetaba el orden de la lista), varios
 * «Canal N» de países distintos y canales de Honduras que no dicen
 * «Honduras» en el nombre.
 */
const CANALES = desempaquetarCanales(
  empaquetarCanales([
    canal("集安综合", "Generalista", "cn"),
    canal("Canal 3", "Generalista", "gt"),
    canal("Canal 7", "Generalista", "gt"),
    canal("Guatevision", "Generalista", "gt"),
    canal("TN23", "Noticias", "gt"),
    canal("Canal 13 Esquipulas", "Generalista", "gt"),
    canal("HCH", "Noticias", "hn"),
    canal("Hondured 13", "Generalista", "hn"),
    canal("Canal 11 TuTV", "Generalista", "sv"),
    canal("Canal 7 Jujuy", "Generalista", "ar"),
    canal("TUDN", "Deportes", "mx"),
    canal("ESPN", "Deportes", "us"),
    canal("Discovery Kids", "Infantil", "us"),
    canal("CNN", "Noticias", "us"),
  ]),
);

const nombres = (texto: string) => buscarCanales(CANALES, texto).map((c) => c.name);

describe("buscarCanales", () => {
  it("«guate» trae los de Guatemala, con Guatevision (por el nombre) delante", () => {
    const encontrados = nombres("guate");
    expect(encontrados[0]).toBe("Guatevision");
    expect(new Set(encontrados)).toEqual(
      new Set(["Guatevision", "Canal 3", "Canal 7", "TN23", "Canal 13 Esquipulas"]),
    );
  });

  it("«honduras» trae los de Honduras aunque su nombre no lo diga", () => {
    expect(nombres("honduras")).toEqual(["HCH", "Hondured 13"]);
  });

  it("los apodos también cuentan: «catracho», «chapín»", () => {
    expect(nombres("catrachos")).toEqual(["HCH", "Hondured 13"]);
    expect(nombres("chapín")).toHaveLength(5);
  });

  it("busca por tema y por sinónimo, de lo cercano a lo lejano", () => {
    expect(nombres("noticias")).toEqual(["TN23", "HCH", "CNN"]);
    expect(nombres("fútbol")).toEqual(["TUDN", "ESPN"]);
    expect(nombres("caricaturas")).toEqual(["Discovery Kids"]);
  });

  it("todas las palabras tienen que casar: «noticias honduras» es HCH", () => {
    expect(nombres("noticias honduras")).toEqual(["HCH"]);
  });

  it("el nombre exacto va primero, y Guatemala antes que Argentina", () => {
    expect(nombres("canal 7")).toEqual(["Canal 7", "Canal 7 Jujuy"]);
  });

  it("un número trae primero el canal que lo lleva y después los que lo nombran", () => {
    const canal7 = CANALES.find((c) => c.name === "Canal 7")!;
    const encontrados = buscarCanales(CANALES, canal7.number);
    expect(encontrados[0].name).toBe("Canal 7");
    // «13» casa con el nombre de dos canales: los dos, Guatemala delante.
    expect(nombres("13").slice(0, 2)).toEqual(["Canal 13 Esquipulas", "Hondured 13"]);
  });

  it("no distingue tildes ni mayúsculas, y el texto vacío no trae nada", () => {
    expect(nombres("GUATEVISIÓN")).toEqual(["Guatevision"]);
    expect(nombres("   ")).toEqual([]);
  });

  it("una letra suelta no casa con el país ni por dentro del nombre", () => {
    // «h» empieza «HCH» y «Hondured»; no trae todo lo que lleva una hache.
    expect(nombres("h")).toEqual(["HCH", "Hondured 13"]);
  });

  it("nada que coincida devuelve una lista vacía y una pista útil", () => {
    expect(nombres("xyzzy")).toEqual([]);
    expect(textoSinResultados(" xyzzy ")).toBe(
      "No hay canales con «xyzzy». Prueba con el país («Honduras») o el tema («noticias»).",
    );
  });

  it("el índice se calcula una vez por lista", () => {
    expect(indexarBusqueda(CANALES)).toBe(indexarBusqueda(CANALES));
    expect(indexarBusqueda([...CANALES])).not.toBe(indexarBusqueda(CANALES));
  });
});
