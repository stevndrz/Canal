import { describe, expect, it } from "vitest";
import {
  claveDeCanalEstable,
  claveDeId,
  idsDeClaves,
  idsEnOrden,
  leerGuardado,
  migrarIdsAClaves,
} from "./claves-canal";
import { buscarUltimo } from "./channels";
import {
  desempaquetarCanales,
  empaquetarCanales,
  recortarPaquete,
  type CanalDeOrigen,
} from "./canales-empaquetados";

function canal(name: string, pais: string, url = name): CanalDeOrigen {
  return {
    name,
    category: pais === "gt" ? "Guatemala" : "Internacional",
    logoUrl: "",
    streamUrl: `https://stream.test/${encodeURIComponent(url)}.m3u8`,
    tema: "Generalista",
    pais,
  };
}

const ORIGEN = [
  canal("Canal 3", "gt"),
  canal("Canal 7", "gt"),
  canal("Guatevision HD", "gt"),
  canal("Canal 3", "ar"),
  canal("ESPN", "us"),
];
const PAQUETE = empaquetarCanales(ORIGEN);
const HOY = desempaquetarCanales(PAQUETE);
const por = (lista: typeof HOY, nombre: string, pais: string) =>
  lista.find((c) => c.name === nombre && claveDeCanalEstable(c).endsWith(`.${pais}`))!;

describe("clave estable de un canal", () => {
  it("es nombre normalizado + país, sin acentos, mayúsculas ni sufijos de calidad", () => {
    expect(claveDeCanalEstable(por(HOY, "Canal 7", "gt"))).toBe("canal7.gt");
    expect(claveDeCanalEstable(por(HOY, "Guatevision HD", "gt"))).toBe("guatevision.gt");
  });

  it("distingue el Canal 3 de Guatemala del de Argentina", () => {
    expect(claveDeCanalEstable(por(HOY, "Canal 3", "gt"))).toBe("canal3.gt");
    expect(claveDeCanalEstable(por(HOY, "Canal 3", "ar"))).toBe("canal3.ar");
  });

  it("no cambia aunque la lista gane canales delante y se corran los ids", () => {
    const manana = desempaquetarCanales(empaquetarCanales([canal("Nuevo", "gt"), ...ORIGEN]));
    const antes = por(HOY, "Canal 7", "gt");
    const despues = por(manana, "Canal 7", "gt");
    expect(despues.id).not.toBe(antes.id);
    expect(claveDeCanalEstable(despues)).toBe(claveDeCanalEstable(antes));
    expect([...idsDeClaves(["canal7.gt"], manana)]).toEqual([despues.id]);
  });

  it("no cambia aunque el proveedor cambie la URL", () => {
    const otraUrl = desempaquetarCanales(
      empaquetarCanales([canal("Canal 7", "gt", "token-nuevo"), ...ORIGEN.slice(2)]),
    );
    expect(claveDeCanalEstable(otraUrl[0])).toBe("canal7.gt");
  });
});

describe("traducir claves a ids", () => {
  it("ignora las claves de canales que hoy no están, sin perderlas", () => {
    const claves = ["canal7.gt", "yanoexiste.mx"];
    expect([...idsDeClaves(claves, HOY)]).toEqual([por(HOY, "Canal 7", "gt").id]);
    // La clave sigue en la lista guardada: si el canal vuelve, vuelve el favorito.
    expect(claves).toContain("yanoexiste.mx");
  });

  it("en orden y sin repetir, para los recientes", () => {
    expect(idsEnOrden(["espn.us", "canal7.gt", "espn.us"], HOY)).toEqual([
      por(HOY, "ESPN", "us").id,
      por(HOY, "Canal 7", "gt").id,
    ]);
  });

  it("funciona sobre el recorte del HTML, donde los ids no son índices", () => {
    const recorte = desempaquetarCanales(recortarPaquete(PAQUETE, [1, 4]));
    expect([...idsDeClaves(["espn.us"], recorte)]).toEqual([por(HOY, "ESPN", "us").id]);
    expect(claveDeId(recorte, por(HOY, "ESPN", "us").id)).toBe("espn.us");
  });
});

describe("migración de los favoritos viejos (ids) a claves", () => {
  const idsViejos = [por(HOY, "Canal 7", "gt").id, por(HOY, "Canal 3", "ar").id];

  it("traduce cada id al canal que hoy ocupa ese sitio, que es el que se ve como favorito", () => {
    expect(migrarIdsAClaves(idsViejos, HOY, true)).toEqual(["canal7.gt", "canal3.ar"]);
  });

  it("con el recorte espera si falta alguno: darlo por perdido lo borraría", () => {
    const recorte = desempaquetarCanales(recortarPaquete(PAQUETE, [1]));
    expect(migrarIdsAClaves(idsViejos, recorte, false)).toBeNull();
  });

  it("con el recorte migra ya si están todos", () => {
    const recorte = desempaquetarCanales(recortarPaquete(PAQUETE, [1, 3]));
    expect(migrarIdsAClaves(idsViejos, recorte, false)).toEqual(["canal7.gt", "canal3.ar"]);
  });

  it("con la lista completa descarta solo los ids que ya no existen", () => {
    expect(migrarIdsAClaves([...idsViejos, 999], HOY, true)).toEqual(["canal7.gt", "canal3.ar"]);
  });

  it("sin lista todavía no hace nada", () => {
    expect(migrarIdsAClaves(idsViejos, [], true)).toBeNull();
  });

  it("tras migrar, los favoritos sobreviven a que la lista cambie", () => {
    const claves = migrarIdsAClaves(idsViejos, HOY, true)!;
    const manana = desempaquetarCanales(
      empaquetarCanales([canal("Nuevo 1", "gt"), canal("Nuevo 2", "mx"), ...[...ORIGEN].reverse()]),
    );
    const nombres = [...idsDeClaves(claves, manana)].map((id) => {
      const c = manana.find((x) => x.id === id)!;
      return claveDeCanalEstable(c);
    });
    expect(nombres.sort()).toEqual(["canal3.ar", "canal7.gt"]);
  });
});

describe("leer lo guardado", () => {
  it("reconoce el formato nuevo, el viejo y la basura", () => {
    expect(leerGuardado('["canal7.gt"]')).toEqual({ claves: ["canal7.gt"] });
    expect(leerGuardado("[3,17]")).toEqual({ ids: [3, 17] });
    expect(leerGuardado("[]")).toEqual({ claves: [] });
    expect(leerGuardado(null)).toBeNull();
    expect(leerGuardado("{roto")).toBeNull();
    expect(leerGuardado('{"a":1}')).toBeNull();
    expect(leerGuardado('[1,"mezcla"]')).toBeNull();
  });
});

describe("último canal con clave", () => {
  it("no confunde el Canal 3 de Argentina con el de Guatemala aunque se haya movido", () => {
    const ar = por(HOY, "Canal 3", "ar");
    const ultimo = { id: 999, nombre: "Canal 3", clave: "canal3.ar" };
    expect(buscarUltimo(HOY, ultimo)).toBe(ar.id);
    // Sin clave (guardado antiguo) se queda con el primero por nombre, como antes.
    expect(buscarUltimo(HOY, { id: 999, nombre: "Canal 3" })).toBe(por(HOY, "Canal 3", "gt").id);
  });
});
