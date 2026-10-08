import { describe, expect, it } from "vitest";
import {
  claveDeRecuento,
  filasDeCanales,
  indexarCanales,
  normalizarCasa,
  ordenarFichas,
  rielesDeInicio,
  type Fila,
  type Ficha,
  type OpcionesFilas,
} from "./secciones-canales";
import { anotarPais, paisDe } from "./origenes";
import type { Channel } from "./types";

let siguienteId = 1;

/** Un canal ya desempaquetado: el tema en `category` y el país apuntado aparte. */
function canal(name: string, tema: string, pais: string): Channel {
  const id = siguienteId++;
  const c: Channel = {
    id,
    name,
    number: String(100 + id),
    category: tema,
    logoUrl: "",
    streamUrl: `https://s.test/${id}.m3u8`,
  };
  anotarPais(c, pais);
  return c;
}

const CASA = normalizarCasa(["Canal 3", "Canal 7", "Guatevision"]);

const canal3 = canal("Canal 3", "Generalista", "gt");
const canal7 = canal("Canal 7", "Generalista", "gt");
const guatevision = canal("Guatevision", "Noticias", "gt");
const tn23 = canal("TN23", "Noticias", "gt");
const peniel = canal("Peniel TV", "Religión", "gt");
const amigos = canal("Amigos TV Chiquimula", "Religión", "gt");
const hch = canal("HCH", "Noticias", "hn");
const tutv = canal("Canal 11 TuTV", "Generalista", "sv");
const tudn = canal("TUDN", "Deportes", "mx");
const azteca = canal("Azteca 7", "Generalista", "mx");
const telesur = canal("Telesur", "Noticias", "ve");
const espn = canal("ESPN", "Deportes", "us");
const golf = canal("30A Golf Kingdom", "Deportes", "us");
const nhk = canal("NHK World", "Noticias", "jp");
const zdf = canal("ZDF", "Generalista", "de");
const huerfano = canal("Sin Origen TV", "Otros", "");

const TODOS = [
  canal3, canal7, guatevision, tn23, peniel, amigos, hch, tutv, tudn, azteca,
  telesur, espn, golf, nhk, zdf, huerfano,
];

const indice = indexarCanales(TODOS, CASA);

function opciones(extra: Partial<OpcionesFilas> = {}): OpcionesFilas {
  return {
    indice,
    filtro: "todo",
    abierta: null,
    busqueda: "",
    deLaCasa: [canal3, canal7, guatevision],
    favoritos: [],
    recientes: [],
    caidos: new Set(),
    porSeccion: 8,
    ...extra,
  };
}

const titulos = (filas: Fila[]) =>
  filas.filter((f) => f.tipo === "cabecera").map((f) => (f.tipo === "cabecera" ? f.titulo : ""));
const canalesDe = (filas: Fila[]) =>
  filas.flatMap((f) => (f.tipo === "canal" ? [f.canal.name] : []));

describe("ordenarFichas: el orden dentro de una sección", () => {
  const ficha = (f: Ficha) => f;

  it("la casa primero, luego lo curado, luego el tema y luego el nombre", () => {
    const fichas: Ficha[] = [
      { nombre: "Zeta Religión", tema: "Religión", pais: "gt" },
      { nombre: "Alfa Noticias", tema: "Noticias", pais: "gt" },
      { nombre: "TN23", tema: "Noticias", pais: "gt" },
      { nombre: "Guatevision", tema: "Noticias", pais: "gt" },
      { nombre: "Canal 7", tema: "Generalista", pais: "gt" },
      { nombre: "Beta Generalista", tema: "Generalista", pais: "gt" },
      { nombre: "Canal 3", tema: "Generalista", pais: "gt" },
    ];
    expect(ordenarFichas(fichas, ficha, CASA).map((f) => f.nombre)).toEqual([
      "Canal 3",
      "Canal 7",
      "Guatevision",
      // TN23 está en la lista de importantes de Guatemala.
      "TN23",
      "Beta Generalista",
      "Alfa Noticias",
      "Zeta Religión",
    ]);
  });

  it("en Deportes, ESPN y TUDN van delante de un canal de golf", () => {
    const fichas: Ficha[] = [
      { nombre: "30A Golf Kingdom", tema: "Deportes", pais: "us" },
      { nombre: "TUDN", tema: "Deportes", pais: "mx" },
      { nombre: "ESPN", tema: "Deportes", pais: "us" },
    ];
    expect(ordenarFichas(fichas, ficha, CASA).map((f) => f.nombre)).toEqual([
      "ESPN",
      "TUDN",
      "30A Golf Kingdom",
    ]);
  });
});

describe("filasDeCanales: el resumen", () => {
  const filas = filasDeCanales(opciones());

  it("va de lo mío a lo de aquí y deja lo lejano plegado", () => {
    expect(titulos(filas)).toEqual([
      "Mis canales",
      "Deportes",
      "Noticias",
      "Guatemala",
      "Centroamérica",
      "México",
      "Sudamérica",
      "Más lejos",
    ]);
    // Sin canales de España ni del Caribe, esas secciones no existen: mejor
    // eso que un encabezado con un hueco debajo.
    const plegadas = filas.flatMap((f) => (f.tipo === "plegada" ? [`${f.region}:${f.total}`] : []));
    expect(plegadas).toEqual(["eeuu:2", "mundo:2", "sin-pais:1"]);
  });

  it("sin favoritos, explica cómo tener uno", () => {
    expect(filas.some((f) => f.tipo === "aviso" && f.clave === "aviso:mios" && f.texto.includes("estrella"))).toBe(true);
    const conFavorito = filasDeCanales(opciones({ favoritos: [hch] }));
    expect(conFavorito.some((f) => f.tipo === "aviso")).toBe(false);
    expect(canalesDe(conFavorito).slice(0, 4)).toEqual(["Canal 3", "Canal 7", "Guatevision", "HCH"]);
  });

  it("Guatemala no repite los de «Mis canales» y aun así dice cuántos tiene de verdad", () => {
    const guatemala = filas.slice(
      filas.findIndex((f) => f.tipo === "cabecera" && f.titulo === "Guatemala"),
    );
    const cabecera = guatemala[0];
    expect(cabecera.tipo === "cabecera" && cabecera.detalle).toBe("6 canales");
    const siguientes = guatemala.slice(1, 4).map((f) => (f.tipo === "canal" ? f.canal.name : f.tipo));
    expect(siguientes).toEqual(["TN23", "Amigos TV Chiquimula", "Peniel TV"]);
    // Se enseñan 3 de 6: hace falta el «Ver los 6».
    expect(guatemala[4]).toMatchObject({ tipo: "ver-todos", region: "guatemala", total: 6 });
  });

  it("una sección corta y sin repetidos no lleva «Ver los N»", () => {
    const mexico = filas.findIndex((f) => f.tipo === "cabecera" && f.titulo === "México");
    expect(filas[mexico + 3].tipo).toBe("cabecera");
  });

  it("corta cada sección en `porSeccion`", () => {
    const cortas = filasDeCanales(opciones({ porSeccion: 1 }));
    const gt = cortas.findIndex((f) => f.tipo === "cabecera" && f.titulo === "Guatemala");
    expect(cortas[gt + 1]).toMatchObject({ tipo: "canal" });
    expect(cortas[gt + 2]).toMatchObject({ tipo: "ver-todos", total: 6 });
  });

  it("los caídos bajan al final de su sección sin desaparecer", () => {
    const conCaido = filasDeCanales(opciones({ caidos: new Set([tn23.id]) }));
    const gt = conCaido.findIndex((f) => f.tipo === "cabecera" && f.titulo === "Guatemala");
    expect(conCaido[gt + 1]).toMatchObject({ tipo: "canal", canal: amigos });
    expect(canalesDe(conCaido)).toContain("TN23");
  });

  it("cada fila tiene clave única, aunque un canal salga en dos secciones", () => {
    const conRepetido = filasDeCanales(opciones({ favoritos: [hch], recientes: [tudn, hch] }));
    const claves = conRepetido.map((f) => f.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("«Vistos hace poco» no repite lo de arriba", () => {
    const conRecientes = filasDeCanales(opciones({ recientes: [canal7, tudn] }));
    const desde = conRecientes.findIndex((f) => f.tipo === "cabecera" && f.titulo === "Vistos hace poco");
    expect(conRecientes[desde + 1]).toMatchObject({ tipo: "canal", canal: tudn });
    expect(conRecientes[desde + 2].tipo).toBe("cabecera");
  });
});

describe("filasDeCanales: destacados por tema", () => {
  const filas = filasDeCanales(opciones());
  const seccion = (titulo: string) => {
    const desde = filas.findIndex((f) => f.tipo === "cabecera" && f.titulo === titulo);
    const hasta = filas.findIndex((f, i) => i > desde && f.tipo === "cabecera");
    return filas.slice(desde + 1, hasta).flatMap((f) => (f.tipo === "canal" ? [f.canal.name] : []));
  };

  it("mezcla países y pone delante lo importante", () => {
    const deportes = seccion("Deportes");
    expect(deportes.slice(0, 2)).toEqual(["ESPN", "TUDN"]);
  });

  it("no repite los de «Mis canales» ni sale con un tema elegido", () => {
    expect(seccion("Noticias")).not.toContain("Guatevision");
    const conTema = filasDeCanales(opciones({ filtro: "Noticias" }));
    expect(conTema.some((f) => f.clave.startsWith("cab:tema:"))).toBe(false);
  });
});

describe("filasDeCanales: el chip de tema filtra todas las secciones a la vez", () => {
  it("y cada cabecera dice cuántos quedan", () => {
    const filas = filasDeCanales(opciones({ filtro: "Noticias" }));
    expect(titulos(filas)).toEqual(["Mis canales", "Guatemala", "Centroamérica", "Sudamérica", "Más lejos"]);
    const gt = filas.find((f) => f.tipo === "cabecera" && f.titulo === "Guatemala");
    expect(gt).toMatchObject({ detalle: "2 de Noticias" });
    expect(canalesDe(filas)).toEqual(["Guatevision", "TN23", "HCH", "Telesur"]);
  });

  it("«Mis canales» solo deja la casa y los favoritos", () => {
    const filas = filasDeCanales(opciones({ filtro: "mios", favoritos: [espn], recientes: [hch] }));
    expect(titulos(filas)).toEqual(["Mis canales", "Vistos hace poco"]);
  });

  it("«Más» reúne los temas de la cola", () => {
    const filas = filasDeCanales(opciones({ filtro: "mas" }));
    expect(canalesDe(filas)).toContain("Canal 11 TuTV");
    expect(canalesDe(filas)).not.toContain("HCH");
  });

  it("sin nada de ese tema, lo dice en vez de enseñar cabeceras vacías", () => {
    const filas = filasDeCanales(opciones({ filtro: "Compras" }));
    expect(filas).toEqual([{ tipo: "aviso", clave: "aviso:vacio", texto: "No hay canales de este tema." }]);
  });
});

describe("los totales salen de la lista COMPLETA aunque solo haya llegado el recorte", () => {
  it("«Ver los 527 de Sudamérica» con un solo canal en la mano", () => {
    const recuentos = new Map([
      [claveDeRecuento("sudamerica", null), 527],
      [claveDeRecuento("sudamerica", "Noticias"), 42],
    ]);
    const filas = filasDeCanales(opciones({ recuentos }));
    expect(filas.find((f) => f.tipo === "ver-todos" && f.region === "sudamerica")).toMatchObject({
      total: 527,
    });
    const soloNoticias = filasDeCanales(opciones({ recuentos, filtro: "Noticias" }));
    expect(
      soloNoticias.find((f) => f.tipo === "cabecera" && f.titulo === "Sudamérica"),
    ).toMatchObject({ detalle: "42 de Noticias" });
  });
});

describe("filasDeCanales: una sección entera («Ver los N»)", () => {
  it("empieza con «volver» y la cabecera, y no salta a los de la casa", () => {
    const filas = filasDeCanales(opciones({ abierta: "guatemala" }));
    expect(filas[0]).toMatchObject({ tipo: "volver", region: "guatemala" });
    expect(filas[1]).toMatchObject({ tipo: "cabecera", titulo: "Guatemala", detalle: "6 canales" });
    expect(canalesDe(filas)).toEqual([
      "Canal 3", "Canal 7", "Guatevision", "TN23", "Amigos TV Chiquimula", "Peniel TV",
    ]);
  });

  it("el resto del mundo se parte por país, en orden alfabético", () => {
    const filas = filasDeCanales(opciones({ abierta: "mundo" }));
    const paises = filas.flatMap((f) => (f.tipo === "subcabecera" ? [f.titulo] : []));
    expect(paises).toEqual(["Alemania", "Japón"]);
  });

  it("todas las filas son de un tipo que la lista sabe pintar a la misma altura", () => {
    const tipos = new Set(
      [
        ...filasDeCanales(opciones()),
        ...filasDeCanales(opciones({ abierta: "centroamerica" })),
        ...filasDeCanales(opciones({ busqueda: "zzz" })),
      ].map((f) => f.tipo),
    );
    expect([...tipos].every((t) =>
      ["cabecera", "subcabecera", "canal", "aviso", "ver-todos", "plegada", "volver"].includes(t),
    )).toBe(true);
  });
});

describe("buscar dentro de Canales", () => {
  it("encuentra por país, no solo por nombre", () => {
    expect(canalesDe(filasDeCanales(opciones({ busqueda: "honduras" })))).toEqual(["HCH"]);
    expect(canalesDe(filasDeCanales(opciones({ busqueda: "guate" })))).toEqual([
      "Canal 3", "Canal 7", "Guatevision", "TN23", "Amigos TV Chiquimula", "Peniel TV",
    ]);
  });

  it("combina palabras y temas sin tildes", () => {
    expect(canalesDe(filasDeCanales(opciones({ busqueda: "noticias japon" })))).toEqual(["NHK World"]);
  });

  it("sin resultados, sugiere cómo buscar", () => {
    const [aviso] = filasDeCanales(opciones({ busqueda: "xyz" }));
    expect(aviso).toMatchObject({ tipo: "aviso" });
    expect(aviso.tipo === "aviso" && aviso.texto).toContain("Honduras");
  });
});

describe("rielesDeInicio", () => {
  const rieles = rielesDeInicio(TODOS, (c) => ({ nombre: c.name, tema: c.category, pais: paisDe(c) }), CASA, {
    porRiel: 20,
  });
  const nombres = (clave: string) => rieles.find((r) => r.riel.clave === clave)!.items.map((c) => c.name);

  it("el riel de Guatemala no repite los de la casa, pero cuenta todos", () => {
    expect(nombres("guatemala")).toEqual(["TN23", "Amigos TV Chiquimula", "Peniel TV"]);
    expect(rieles.find((r) => r.riel.clave === "guatemala")!.total).toBe(6);
  });

  it("los de tema van primero lo curado y luego lo de aquí", () => {
    expect(nombres("deportes")).toEqual(["ESPN", "TUDN", "30A Golf Kingdom"]);
    // Telesur está en la lista de importantes de Noticias; HCH no, y por eso
    // va detrás aunque Honduras quede más cerca.
    expect(nombres("noticias")).toEqual(["Guatevision", "TN23", "Telesur", "HCH", "NHK World"]);
  });
});

