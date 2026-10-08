import { describe, expect, it } from "vitest";
import { FIN_DE_BLOQUE, INICIO_DE_BLOQUE, numerarCanales, type ParaNumerar } from "./numeracion";
import { REGIONES, regionDePais } from "./origenes";

const c = (nombre: string, pais: string): ParaNumerar => ({ nombre, pais, url: `https://s.test/${nombre}` });

describe("numeración de canales", () => {
  const LISTA = [
    c("TN23", "gt"),
    c("Canal 7", "gt"),
    c("Sol TV", "gt"),
    c("Canal 3", "gt"),
    c("Guatevision", "gt"),
    c("Amigos TV", "gt"),
    c("Canal 3", "ar"),
    c("HCH", "hn"),
    c("ESPN", "us"),
  ];

  it("los fijos de Guatemala llevan su número de siempre", () => {
    const n = numerarCanales(LISTA);
    expect(n[1]).toBe(7);
    expect(n[3]).toBe(3);
    expect(n[0]).toBe(23);
    expect(n[4]).toBe(25);
  });

  it("el resto de Guatemala, por nombre desde el 30", () => {
    const n = numerarCanales(LISTA);
    expect(n[5]).toBe(30); // Amigos TV
    expect(n[2]).toBe(31); // Sol TV
  });

  it("el Canal 3 de Argentina no se queda el fijo", () => {
    expect(numerarCanales(LISTA)[6]).toBe(INICIO_DE_BLOQUE.sudamerica);
  });

  it("ordena las cifras como números: Canal 13 antes que Canal 100", () => {
    const n = numerarCanales([c("Canal 100 Chinique", "gt"), c("Canal 13 Esquipulas", "gt")]);
    expect(n).toEqual([31, 30]);
  });

  it("no repite ningún número", () => {
    const n = numerarCanales(LISTA);
    expect(new Set(n).size).toBe(n.length);
  });

  it("un canal nuevo solo mueve los de su bloque, y nunca los fijos", () => {
    const antes = numerarCanales(LISTA);
    const despues = numerarCanales([c("AAA Nuevo", "gt"), ...LISTA]).slice(1);
    for (const i of [0, 1, 3, 4, 6, 7, 8]) expect(despues[i]).toBe(antes[i]);
    expect(despues[5]).toBe(31); // Amigos TV se corre uno, dentro de Guatemala
  });

  it("no depende del orden en que llegan", () => {
    const n = numerarCanales(LISTA);
    const alReves = numerarCanales([...LISTA].reverse()).reverse();
    expect(alReves).toEqual(n);
  });

  it("todos los bloques caben en cuatro cifras y no se pisan", () => {
    const rangos = REGIONES.map((r) => [INICIO_DE_BLOQUE[r], FIN_DE_BLOQUE[r]]).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < rangos.length; i++) expect(rangos[i][0]).toBeGreaterThan(rangos[i - 1][1]);
    expect(Math.max(...rangos.map((r) => r[1]))).toBeLessThan(10000);
    expect(regionDePais("gt")).toBe("guatemala");
  });
});
