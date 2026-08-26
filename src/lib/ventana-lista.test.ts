import { describe, expect, it } from "vitest";
import { HOLGURA, calcularVentana, ventanaCambio, type MedidasLista } from "./ventana-lista";

/** Una lista realista: 7.822 canales, filas de 72px, ventana de 1080. */
const BASE: MedidasLista = {
  desplazamiento: 0,
  alto: 1080,
  inicioLista: 300,
  altoFila: 72,
  total: 7_822,
};

describe("calcularVentana", () => {
  it("arriba del todo empieza en la primera fila", () => {
    const v = calcularVentana(BASE);
    expect(v.desde).toBe(0);
    expect(v.huecoArriba).toBe(0);
  });

  it("monta lo visible más la holgura, no la lista entera", () => {
    const v = calcularVentana(BASE);
    const montadas = v.hasta - v.desde;
    // 1080/72 = 15 filas visibles, + 12 de holgura por lado.
    expect(montadas).toBeLessThan(50);
    // Es el número que de verdad importa: antes eran 7.822.
    expect(montadas).toBeLessThan(BASE.total / 100);
  });

  it("al bajar, la ventana se desplaza con el scroll", () => {
    const arriba = calcularVentana(BASE);
    const medio = calcularVentana({ ...BASE, desplazamiento: 300 + 72 * 400 });
    expect(medio.desde).toBeGreaterThan(arriba.desde);
    expect(medio.desde).toBe(400 - HOLGURA);
    expect(medio.huecoArriba).toBe((400 - HOLGURA) * 72);
  });

  it("los huecos suman siempre el alto de lo que NO se monta", () => {
    for (const desplazamiento of [0, 5_000, 100_000, 500_000]) {
      const v = calcularVentana({ ...BASE, desplazamiento });
      const sinMontar = BASE.total - (v.hasta - v.desde);
      expect(v.huecoArriba + v.huecoAbajo).toBe(sinMontar * 72);
    }
  });

  it("al final de la lista no se pasa del total ni deja hueco abajo", () => {
    const v = calcularVentana({ ...BASE, desplazamiento: 300 + 72 * BASE.total });
    expect(v.hasta).toBe(BASE.total);
    expect(v.huecoAbajo).toBe(0);
  });

  it("la holgura es lo que deja al mando saltar a la siguiente fila", () => {
    // Sin filas de margen, la de justo debajo del borde no existiría en el DOM
    // y el foco se quedaría clavado en la última visible.
    const conMargen = calcularVentana({ ...BASE, desplazamiento: 300 + 72 * 100 });
    const sinMargen = calcularVentana({ ...BASE, desplazamiento: 300 + 72 * 100, holgura: 0 });
    expect(conMargen.hasta).toBeGreaterThan(sinMargen.hasta);
    expect(conMargen.desde).toBeLessThan(sinMargen.desde);
  });

  it("antes de poder medir una fila, monta todo: el comportamiento de antes", () => {
    // Es el primer render, cuando aún no hay ninguna fila que medir. Vale más
    // pintar de más una vez que pintar una lista vacía.
    const v = calcularVentana({ ...BASE, altoFila: 0 });
    expect(v).toEqual({ desde: 0, hasta: BASE.total, huecoArriba: 0, huecoAbajo: 0 });
    expect(calcularVentana({ ...BASE, altoFila: Number.NaN }).hasta).toBe(BASE.total);
  });

  it("una lista vacía no rompe nada", () => {
    const v = calcularVentana({ ...BASE, total: 0 });
    expect(v).toEqual({ desde: 0, hasta: 0, huecoArriba: 0, huecoAbajo: 0 });
  });

  it("con la lista aún por debajo del borde, sigue en la primera fila", () => {
    // `inicioLista` mayor que el desplazamiento: nada de la lista ha subido.
    const v = calcularVentana({ ...BASE, desplazamiento: 100, inicioLista: 900 });
    expect(v.desde).toBe(0);
  });
});

describe("ventanaCambio", () => {
  it("solo pide repintar cuando cambian los índices", () => {
    const a = calcularVentana(BASE);
    // Dos píxeles de scroll no mueven la ventana: repintar ahí sería tirar
    // trabajo en una tele que ya va justa.
    expect(ventanaCambio(a, calcularVentana({ ...BASE, desplazamiento: 2 }))).toBe(false);
    expect(ventanaCambio(a, calcularVentana({ ...BASE, desplazamiento: 300 + 72 * 50 }))).toBe(true);
  });
});
