import { describe, expect, it } from "vitest";
import {
  FALLOS_PARA_APARTAR,
  OLVIDO_MS,
  claveDeCanal,
  estaCaido,
  ordenarPorSalud,
  registrarExito,
  registrarFallo,
  type MemoriaCaidos,
} from "./canales-caidos";

const AHORA = 1_800_000_000_000;
const canal = (nombre: string) => ({ name: nombre, streamUrl: `https://x.test/${nombre}.m3u8` });

/** Deja un canal apartado, que es lo que hacen dos fallos seguidos. */
function apartado(url: string, ahora = AHORA): MemoriaCaidos {
  let memoria: MemoriaCaidos = {};
  for (let i = 0; i < FALLOS_PARA_APARTAR; i += 1) {
    memoria = registrarFallo(memoria, claveDeCanal(url), ahora);
  }
  return memoria;
}

describe("claveDeCanal", () => {
  it("dos canales distintos no comparten clave", () => {
    const claves = new Set(
      Array.from({ length: 2_000 }, (_, i) => claveDeCanal(`https://x.test/canal-${i}.m3u8`)),
    );
    expect(claves.size).toBe(2_000);
  });

  it("la misma URL da siempre la misma clave", () => {
    expect(claveDeCanal("https://x.test/a.m3u8")).toBe(claveDeCanal("https://x.test/a.m3u8"));
  });

  it("es corta: se guardan cientos y localStorage no puede crecer sin control", () => {
    expect(claveDeCanal("https://x.test/muy/larga/de/verdad.m3u8").length).toBeLessThanOrEqual(7);
  });
});

describe("apartar un canal", () => {
  it("**un solo fallo NO aparta nada**", () => {
    // Un corte puntual del proveedor, o un segundo malo de wifi, no convierten
    // a un canal en un cadáver.
    const memoria = registrarFallo({}, claveDeCanal("https://x.test/a.m3u8"), AHORA);
    expect(estaCaido(memoria, claveDeCanal("https://x.test/a.m3u8"), AHORA)).toBe(false);
  });

  it("dos seguidos sí", () => {
    const memoria = apartado("https://x.test/a.m3u8");
    expect(estaCaido(memoria, claveDeCanal("https://x.test/a.m3u8"), AHORA)).toBe(true);
  });

  it("verlo funcionar le borra el historial entero, no le resta un fallo", () => {
    const memoria = registrarExito(apartado("https://x.test/a.m3u8"), claveDeCanal("https://x.test/a.m3u8"));
    expect(estaCaido(memoria, claveDeCanal("https://x.test/a.m3u8"), AHORA)).toBe(false);
    // Y al siguiente fallo vuelve a empezar de cero: uno solo no lo aparta.
    const otra = registrarFallo(memoria, claveDeCanal("https://x.test/a.m3u8"), AHORA);
    expect(estaCaido(otra, claveDeCanal("https://x.test/a.m3u8"), AHORA)).toBe(false);
  });

  it("**se olvida a los siete días**: estos canales resucitan", () => {
    const memoria = apartado("https://x.test/a.m3u8");
    const clave = claveDeCanal("https://x.test/a.m3u8");
    expect(estaCaido(memoria, clave, AHORA + OLVIDO_MS - 1)).toBe(true);
    expect(estaCaido(memoria, clave, AHORA + OLVIDO_MS + 1)).toBe(false);
  });

  it("un canal del que no se sabe nada no está caído", () => {
    expect(estaCaido({}, claveDeCanal("https://x.test/nuevo.m3u8"), AHORA)).toBe(false);
  });
});

describe("ordenarPorSalud", () => {
  const lista = [canal("uno"), canal("dos"), canal("tres"), canal("cuatro")];

  it("**no pierde ninguno**: los aparta, no los esconde", () => {
    const memoria = apartado(lista[1].streamUrl);
    const ordenados = ordenarPorSalud(lista, memoria, AHORA);
    expect(ordenados).toHaveLength(lista.length);
    expect(new Set(ordenados.map((c) => c.name))).toEqual(new Set(lista.map((c) => c.name)));
  });

  it("los caídos van al final", () => {
    const memoria = apartado(lista[0].streamUrl);
    expect(ordenarPorSalud(lista, memoria, AHORA).map((c) => c.name)).toEqual([
      "dos", "tres", "cuatro", "uno",
    ]);
  });

  it("conserva el orden relativo de los sanos entre sí", () => {
    const memoria = apartado(lista[2].streamUrl);
    const sanos = ordenarPorSalud(lista, memoria, AHORA).slice(0, 3).map((c) => c.name);
    expect(sanos).toEqual(["uno", "dos", "cuatro"]);
  });

  it("sin nada apuntado devuelve el MISMO array, sin recorrerlo", () => {
    // Es el caso normal, y con 7.822 canales recorrerlo dos veces para nada se
    // nota en un televisor.
    expect(ordenarPorSalud(lista, {}, AHORA)).toBe(lista);
  });

  it("si ninguno de los apuntados está en esta lista, tampoco se toca", () => {
    const memoria = apartado("https://x.test/otro-que-no-sale.m3u8");
    expect(ordenarPorSalud(lista, memoria, AHORA)).toBe(lista);
  });

  it("un caído que ya caducó vuelve a su sitio solo", () => {
    const memoria = apartado(lista[0].streamUrl);
    expect(ordenarPorSalud(lista, memoria, AHORA + OLVIDO_MS + 1).map((c) => c.name)).toEqual(
      lista.map((c) => c.name),
    );
  });
});

describe("la memoria no crece sin fin", () => {
  it("lo caducado se cae solo al apuntar algo nuevo", () => {
    const viejo = apartado("https://x.test/viejo.m3u8", AHORA - OLVIDO_MS - 1);
    const memoria = registrarFallo(viejo, claveDeCanal("https://x.test/nuevo.m3u8"), AHORA);
    expect(Object.keys(memoria)).toEqual([claveDeCanal("https://x.test/nuevo.m3u8")]);
  });

  it("nunca pasa del tope, y lo que sobrevive es lo más reciente", () => {
    let memoria: MemoriaCaidos = {};
    for (let i = 0; i < 600; i += 1) {
      memoria = registrarFallo(memoria, claveDeCanal(`https://x.test/${i}.m3u8`), AHORA + i);
    }
    expect(Object.keys(memoria).length).toBeLessThanOrEqual(400);
    expect(memoria[claveDeCanal("https://x.test/599.m3u8")]).toBeDefined();
    expect(memoria[claveDeCanal("https://x.test/0.m3u8")]).toBeUndefined();
  });
});
