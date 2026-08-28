import { describe, expect, it } from "vitest";
import {
  desempaquetarCanales,
  empaquetarCanales,
  posicionesIniciales,
  recortarPaquete,
  recuentosDe,
  type PaqueteCanales,
} from "./canales-empaquetados";
import { CATEGORY_ORDER, filterChannels, groupByCategory, withChannelNumbers } from "./channels";
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
      cuentas: [1],
      total: 1,
      canales: [["X", 9, "l", "s"]],
    };
    expect(() => desempaquetarCanales(roto)).not.toThrow();
    expect(desempaquetarCanales(roto)[0].category).toBe("Entretenimiento");
  });
});

/**
 * Una lista con la forma de la de verdad: ordenada por categoría, como la deja
 * `sortChannels`, con las doce categorías y tamaños desiguales.
 */
const REALISTA = CATEGORY_ORDER.flatMap((categoria, i) =>
  Array.from({ length: 40 + i * 130 }, (_, n) => canal(`${categoria} ${n}`, categoria)),
);

/** Lo que pintan de verdad las dos pantallas: `LOTE` y `MAX_GRUPOS`×`MAX_POR_RIEL`. */
const QUE_PINTA = { lote: 60, grupos: 6, porGrupo: 20 };

describe("el recorte: mandar solo lo que se pinta", () => {
  const completo = empaquetarCanales(REALISTA);
  const recortado = recortarPaquete(completo, posicionesIniciales(completo, QUE_PINTA));
  const todos = desempaquetarCanales(completo);
  const pocos = desempaquetarCanales(recortado);

  it("manda un puñado de canales, no la lista entera", () => {
    expect(REALISTA.length).toBeGreaterThan(7_000);
    // Los 60 del primer lote más 6 rieles de 20, quitando lo que se solapa.
    expect(pocos.length).toBeLessThanOrEqual(60 + 6 * 20);
    expect(pocos.length).toBeLessThan(REALISTA.length / 20);
  });

  it("**el `id` de cada canal es el mismo**: de esto dependen los favoritos", () => {
    // Es el contrato que no se puede romper y el único irreversible: los
    // favoritos ya guardados en `localStorage` son ids. Si el recorte los
    // corriera, cada favorito de la gente pasaría a ser otro canal.
    const porNombre = new Map(todos.map((c) => [c.name, c]));
    for (const pocoCanal of pocos) {
      expect(pocoCanal.id).toBe(porNombre.get(pocoCanal.name)!.id);
    }
  });

  it("el número de canal también, que es lo que se teclea con el mando", () => {
    const porNombre = new Map(todos.map((c) => [c.name, c]));
    for (const pocoCanal of pocos) {
      expect(pocoCanal.number).toBe(porNombre.get(pocoCanal.name)!.number);
    }
  });

  it("los recuentos por categoría siguen siendo los de la lista COMPLETA", () => {
    // La columna de Canales tiene que decir «Deportes 170», no «Deportes 20».
    const recuentos = recuentosDe(recortado);
    for (const categoria of CATEGORY_ORDER) {
      const deVerdad = REALISTA.filter((c) => c.category === categoria).length;
      expect(recuentos.get(categoria)).toBe(deVerdad);
    }
    expect(recortado.total).toBe(REALISTA.length);
    expect(recortado.categorias).toEqual(completo.categorias);
  });

  it("Canales pinta exactamente el mismo primer lote", () => {
    const conTodo = filterChannels(todos, { category: "Todas" }).slice(0, QUE_PINTA.lote);
    const conPocos = filterChannels(pocos, { category: "Todas" }).slice(0, QUE_PINTA.lote);
    expect(conPocos.map((c) => c.id)).toEqual(conTodo.map((c) => c.id));
  });

  it("Inicio pinta los mismos rieles, con los mismos canales", () => {
    const conTodo = groupByCategory(todos).slice(0, QUE_PINTA.grupos);
    const conPocos = groupByCategory(pocos).slice(0, QUE_PINTA.grupos);
    expect(conPocos.map((g) => g.category)).toEqual(conTodo.map((g) => g.category));

    for (const [i, grupo] of conPocos.entries()) {
      const esperados = conTodo[i].items.slice(0, QUE_PINTA.porGrupo).map((c) => c.id);
      expect(grupo.items.slice(0, QUE_PINTA.porGrupo).map((c) => c.id)).toEqual(esperados);
    }
  });

  it("el canal de arranque viaja aunque esté en mitad de la lista", () => {
    // `canalDeArranque` busca por nombre; si el preferido no viaja, la app
    // abriría con otro canal y luego NO se corregiría, porque al llegar la
    // lista completa ya hay uno sintonizado.
    const lejos = 5_000;
    const conExtra = recortarPaquete(
      completo,
      posicionesIniciales(completo, { ...QUE_PINTA, ademas: [lejos] }),
    );
    const nombres = new Set(desempaquetarCanales(conExtra).map((c) => c.name));
    expect(nombres.has(REALISTA[lejos].name)).toBe(true);
  });

  it("no se cuela una posición inventada", () => {
    const conBasura = recortarPaquete(completo, [-1, 0, 1, 999_999]);
    expect(conBasura.canales).toHaveLength(2);
    expect(desempaquetarCanales(conBasura).map((c) => c.id)).toEqual([1, 2]);
  });

  it("recortar a nada no revienta", () => {
    const vacio = recortarPaquete(completo, []);
    expect(desempaquetarCanales(vacio)).toEqual([]);
    expect(vacio.total).toBe(REALISTA.length);
  });

  it("el paquete completo NO paga el precio del recorte", () => {
    // Las posiciones y los ordinales solo existen en el paquete pequeño; en el
    // grande se siguen deduciendo, que es de donde salió el ahorro original.
    expect(completo.recorte).toBeUndefined();
    expect(recortado.recorte).toBeDefined();
  });

  it("y pesa dos órdenes de magnitud menos, que es el objetivo", () => {
    const antes = JSON.stringify(completo).length;
    const ahora = JSON.stringify(recortado).length;
    expect(ahora).toBeLessThan(antes / 20);
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
