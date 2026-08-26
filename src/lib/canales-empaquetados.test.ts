import { describe, expect, it } from "vitest";
import {
  desempaquetarCanales,
  empaquetarCanales,
  type PaqueteCanales,
} from "./canales-empaquetados";
import { withChannelNumbers } from "./channels";
import type { Channel } from "./types";

/** Un canal como lo deja `m3u.ts`, sin `id` ni `number`. */
function canal(name: string, category: string, extra: Partial<Channel> = {}) {
  return {
    name,
    category,
    logoUrl: `https://logos.test/${name}.png`,
    streamUrl: `https://stream.test/${name}.m3u8`,
    ...extra,
  };
}

const MUESTRA = [
  canal("Canal 3", "Guatemala"),
  canal("Canal 7", "Guatemala"),
  canal("ESPN", "Deportes"),
  canal("Canal 9", "Guatemala"),
  canal("Fox Sports", "Deportes"),
];

describe("ida y vuelta", () => {
  it("reconstruye los campos que de verdad viajan", () => {
    const canales = desempaquetarCanales(empaquetarCanales(MUESTRA));
    expect(canales).toHaveLength(MUESTRA.length);
    for (const [i, esperado] of MUESTRA.entries()) {
      expect(canales[i].name).toBe(esperado.name);
      expect(canales[i].category).toBe(esperado.category);
      expect(canales[i].logoUrl).toBe(esperado.logoUrl);
      expect(canales[i].streamUrl).toBe(esperado.streamUrl);
    }
  });

  it("el `id` sale de la posición: por eso no hace falta mandarlo", () => {
    const canales = desempaquetarCanales(empaquetarCanales(MUESTRA));
    expect(canales.map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it("conserva los datos de guía cuando los hay", () => {
    const conGuia = [
      canal("Con guía", "Guatemala", {
        currentProgram: "Noticias",
        nextProgram: "Película",
        currentStart: 1_000,
        currentEnd: 2_000,
        nextStart: 2_000,
      }),
    ];
    const [reconstruido] = desempaquetarCanales(empaquetarCanales(conGuia));
    expect(reconstruido.currentProgram).toBe("Noticias");
    expect(reconstruido.nextProgram).toBe("Película");
    expect(reconstruido.currentStart).toBe(1_000);
    expect(reconstruido.currentEnd).toBe(2_000);
    expect(reconstruido.nextStart).toBe(2_000);
  });

  it("sin guía NO añade las claves: una clave presente cuesta lo mismo que llena", () => {
    const [empaquetado] = empaquetarCanales([canal("Pelado", "Guatemala")]).canales;
    expect(empaquetado).toHaveLength(4);
    const [reconstruido] = desempaquetarCanales(empaquetarCanales([canal("Pelado", "Guatemala")]));
    expect("currentProgram" in reconstruido).toBe(false);
    expect("nextStart" in reconstruido).toBe(false);
  });
});

describe("la numeración es la MISMA que antes", () => {
  it("coincide con `withChannelNumbers`, canal por canal", () => {
    // Es el contrato que no se puede romper: los números de canal son lo que
    // la gente teclea con el mando.
    const comoAntes = withChannelNumbers(
      MUESTRA.map((c, i) => ({ ...c, id: i + 1, number: "0" }) as Channel),
    );
    const comoAhora = desempaquetarCanales(empaquetarCanales(MUESTRA));
    expect(comoAhora.map((c) => c.number)).toEqual(comoAntes.map((c) => c.number));
  });

  it("numera por centenas de categoría, no de corrido", () => {
    const canales = desempaquetarCanales(empaquetarCanales(MUESTRA));
    const porNombre = new Map(canales.map((c) => [c.name, c.number]));
    // Guatemala y Deportes tienen centenas distintas, y cada una cuenta desde 1.
    expect(porNombre.get("Canal 3")).not.toBe(porNombre.get("ESPN"));
    expect(porNombre.get("Canal 3")!.slice(-2)).toBe("01");
    expect(porNombre.get("ESPN")!.slice(-2)).toBe("01");
    expect(porNombre.get("Canal 7")!.slice(-2)).toBe("02");
  });
});

describe("la tabla de categorías", () => {
  it("guarda cada categoría UNA vez, no una por canal", () => {
    const paquete = empaquetarCanales(MUESTRA);
    expect(paquete.categorias).toEqual(["Guatemala", "Deportes"]);
    expect(paquete.canales.map((c) => c[1])).toEqual([0, 0, 1, 0, 1]);
  });

  it("no pierde una categoría que no esté en CATEGORY_ORDER", () => {
    // Una lista M3U ajena puede traer cualquier cosa; perderla al empaquetar
    // cambiaría la clasificación del canal.
    const rara = [canal("Rareza", "Categoría Inventada")];
    const [reconstruido] = desempaquetarCanales(empaquetarCanales(rara));
    expect(reconstruido.category).toBe("Categoría Inventada");
  });

  it("aguanta un índice fuera de rango sin reventar", () => {
    const roto: PaqueteCanales = {
      categorias: ["Guatemala"],
      canales: [["X", 9, "l", "s"]],
    };
    expect(() => desempaquetarCanales(roto)).not.toThrow();
    expect(desempaquetarCanales(roto)[0].category).toBe("Entretenimiento");
  });
});

describe("el ahorro real", () => {
  it("con datos realistas pesa MUCHO menos que el objeto por canal", () => {
    // Reconstruyo la forma real: 7.822 canales, 12 categorías, URLs largas.
    const CATS = [
      "Guatemala", "Deportes", "Noticias", "Películas y series", "Infantil", "Música",
      "Religión", "Entretenimiento", "Documentales", "Español", "Inglés", "Internacional",
    ];
    const muchos = Array.from({ length: 7_822 }, (_, i) =>
      canal(`Canal ${i}`, CATS[i % CATS.length]!),
    );

    const comoAntes = JSON.stringify(
      muchos.map((c, i) => ({ ...c, id: i + 1, number: String(100 + i) })),
    ).length;
    const comoAhora = JSON.stringify(empaquetarCanales(muchos)).length;

    // No se afina el número exacto —depende de los datos— pero el orden de
    // magnitud sí importa y no debe empeorar nunca.
    expect(comoAhora).toBeLessThan(comoAntes * 0.65);
  });
});
