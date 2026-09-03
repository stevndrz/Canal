import { describe, expect, it } from "vitest";
import {
  HORAS_VISIBLES,
  MARGEN_FRANJA_MS,
  PASO_MINUTOS,
  columnasDeFranja,
  estaEnEmision,
  filaDeParrilla,
  inicioDeFranja,
  moverFranja,
  posicionEnFranja,
} from "./parrilla";

const MINUTO = 60_000;
const HORA = 60 * MINUTO;

/** Una franja de tres horas que empieza a las 20:00. */
const DESDE = Date.UTC(2026, 7, 31, 20, 0);
const HASTA = DESDE + HORAS_VISIBLES * HORA;

function programa(inicioMin: number, finMin: number, titulo = "Algo") {
  return { titulo, inicio: DESDE + inicioMin * MINUTO, fin: DESDE + finMin * MINUTO };
}

describe("inicioDeFranja", () => {
  it("cae en la media hora en punto anterior", () => {
    // Empezar en «20:07» no se lee, y una franja que se mueve sola cada minuto
    // hace bailar la parrilla bajo el foco del mando.
    expect(inicioDeFranja(DESDE + 7 * MINUTO)).toBe(DESDE);
    expect(inicioDeFranja(DESDE + 41 * MINUTO)).toBe(DESDE + 30 * MINUTO);
  });

  it("una hora en punto se queda donde está", () => {
    expect(inicioDeFranja(DESDE)).toBe(DESDE);
  });
});

describe("columnasDeFranja", () => {
  it("una marca por cada paso", () => {
    const columnas = columnasDeFranja(DESDE);
    expect(columnas).toHaveLength((HORAS_VISIBLES * 60) / PASO_MINUTOS);
    expect(columnas[0]).toBe(DESDE);
    expect(columnas[1]).toBe(DESDE + PASO_MINUTOS * MINUTO);
  });
});

describe("posicionEnFranja", () => {
  it("la mitad de la franja es el 50%", () => {
    expect(posicionEnFranja(DESDE + 90 * MINUTO, DESDE, HASTA)).toBe(50);
  });

  it("lo de fuera se acota, no se sale de la pantalla", () => {
    expect(posicionEnFranja(DESDE - HORA, DESDE, HASTA)).toBe(0);
    expect(posicionEnFranja(HASTA + HORA, DESDE, HASTA)).toBe(100);
  });
});

describe("filaDeParrilla", () => {
  it("**lo que ya había empezado se pega al borde izquierdo**", () => {
    // A las 20:00 sigue emitiéndose lo que arrancó a las 19:30. Su bloque no
    // puede empezar fuera de la pantalla ni en el minuto 30.
    const fila = filaDeParrilla([programa(-30, 30, "Noticiero")], DESDE, HASTA);
    const bloque = fila.find((b) => b.titulo === "Noticiero")!;
    expect(bloque.izquierda).toBe(0);
    expect(bloque.cortadoAlInicio).toBe(true);
    // La hora que se enseña es la real, no la recortada.
    expect(bloque.inicio).toBe(DESDE - 30 * MINUTO);
  });

  it("lo que se sale por la derecha se corta igual", () => {
    const fila = filaDeParrilla([programa(150, 300, "Película")], DESDE, HASTA);
    const bloque = fila.find((b) => b.titulo === "Película")!;
    expect(bloque.cortadoAlFinal).toBe(true);
    expect(bloque.izquierda + bloque.ancho).toBeCloseTo(100, 5);
  });

  it("**los huecos se dibujan**: dos bloques pegados parecerían seguidos", () => {
    const fila = filaDeParrilla([programa(0, 30), programa(60, 90)], DESDE, HASTA);
    const huecos = fila.filter((b) => b.hueco);
    // Uno entre los dos programas, y otro desde el minuto 90 hasta el final.
    expect(huecos).toHaveLength(2);
    expect(huecos[0].ancho).toBeCloseTo((30 / 180) * 100, 5);
  });

  it("la fila cubre siempre el 100%, sin importar lo que traiga la guía", () => {
    // Es lo que permite pintarla con flex, sin posicionamiento absoluto — más
    // barato en un televisor.
    for (const programas of [
      [],
      [programa(0, 180)],
      [programa(30, 60), programa(120, 150)],
      [programa(-60, 240)],
    ]) {
      const total = filaDeParrilla(programas, DESDE, HASTA).reduce((s, b) => s + b.ancho, 0);
      expect(total, JSON.stringify(programas)).toBeCloseTo(100, 5);
    }
  });

  it("una guía vacía da una franja de hueco, no una fila vacía", () => {
    const fila = filaDeParrilla([], DESDE, HASTA);
    expect(fila).toHaveLength(1);
    expect(fila[0].hueco).toBe(true);
  });

  it("los desajustes de segundos no producen rendijas", () => {
    // Las guías reales encadenan 20:29:58 → 20:30:00. Dibujar esos dos
    // segundos deja una raya de un píxel que parece un fallo de pintado.
    const fila = filaDeParrilla(
      [
        { titulo: "Uno", inicio: DESDE, fin: DESDE + 30 * MINUTO - 2_000 },
        { titulo: "Dos", inicio: DESDE + 30 * MINUTO, fin: HASTA },
      ],
      DESDE,
      HASTA,
    );
    expect(fila.filter((b) => b.hueco)).toHaveLength(0);
  });

  it("ignora lo solapado en vez de dibujar bloques encima", () => {
    // Pasa en las guías agregadas de varias fuentes.
    const fila = filaDeParrilla(
      [programa(0, 120, "Larga"), programa(30, 60, "Solapada")],
      DESDE,
      HASTA,
    );
    expect(fila.map((b) => b.titulo)).not.toContain("Solapada");
    expect(fila.reduce((s, b) => s + b.ancho, 0)).toBeCloseTo(100, 5);
  });

  it("descarta lo que queda entero fuera de la franja", () => {
    const fila = filaDeParrilla([programa(-180, -60, "Ayer")], DESDE, HASTA);
    expect(fila.every((b) => b.hueco)).toBe(true);
  });
});

describe("estaEnEmision", () => {
  it("solo el que contiene el instante, y nunca un hueco", () => {
    const fila = filaDeParrilla([programa(0, 30, "Ahora"), programa(60, 90, "Luego")], DESDE, HASTA);
    const ahora = DESDE + 10 * MINUTO;
    expect(fila.filter((b) => estaEnEmision(b, ahora)).map((b) => b.titulo)).toEqual(["Ahora"]);
  });
});

describe("moverFranja", () => {
  const ahora = DESDE;

  it("adelanta o atrasa el número de horas pedido", () => {
    expect(moverFranja(DESDE, HORAS_VISIBLES, ahora)).toBe(DESDE + HORAS_VISIBLES * HORA);
    expect(moverFranja(DESDE, -HORAS_VISIBLES, ahora)).toBe(DESDE - HORAS_VISIBLES * HORA);
  });

  it("no deja pedir más allá del margen que acepta /api/guia", () => {
    const lejos = ahora + MARGEN_FRANJA_MS - HORA;
    expect(moverFranja(lejos, HORAS_VISIBLES, ahora)).toBe(ahora + MARGEN_FRANJA_MS);
  });

  it("tampoco hacia atrás", () => {
    const lejos = ahora - MARGEN_FRANJA_MS + HORA;
    expect(moverFranja(lejos, -HORAS_VISIBLES, ahora)).toBe(ahora - MARGEN_FRANJA_MS);
  });

  it("dentro del margen no lo toca", () => {
    const propuesta = moverFranja(DESDE, HORAS_VISIBLES, ahora);
    expect(propuesta).toBeGreaterThan(ahora - MARGEN_FRANJA_MS);
    expect(propuesta).toBeLessThan(ahora + MARGEN_FRANJA_MS);
  });
});
