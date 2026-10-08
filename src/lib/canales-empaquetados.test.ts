import { describe, expect, it } from "vitest";
import {
  QUE_SE_PINTA,
  desempaquetarCanales,
  empaquetarCanales,
  posicionesIniciales,
  recortarPaquete,
  recuentosDe,
  recuentosDeLista,
  type CanalDeOrigen,
  type PaqueteCanales,
} from "./canales-empaquetados";
import { CATEGORY_ORDER, canalesDeCasa } from "./channels";
import { paisDe } from "./origenes";
import { TEMAS } from "./temas";
import {
  claveDeRecuento,
  fichaDe,
  filasDeCanales,
  indexarCanales,
  normalizarCasa,
  rielesDeInicio,
} from "./secciones-canales";
import { publicConfig } from "./config";
import type { Channel } from "./types";

/**
 * Un canal como lo deja `m3u.ts`, sin `id` ni `number`: `category` es todavía
 * la categoría de numeración, y el tema y el país van aparte.
 */
function canal(
  name: string,
  category: string,
  extra: Partial<Channel> & { tema?: string; pais?: string } = {},
): CanalDeOrigen {
  return {
    name,
    category,
    logoUrl: `https://logos.test/${name}.png`,
    streamUrl: `https://stream.test/${name}.m3u8`,
    ...extra,
  };
}

const MUESTRA = [
  canal("Canal 3", "Guatemala", { tema: "Generalista", pais: "gt" }),
  canal("Canal 7", "Guatemala", { tema: "Generalista", pais: "gt" }),
  canal("ESPN", "Deportes", { tema: "Deportes", pais: "us" }),
  canal("Canal 9", "Guatemala", { tema: "Generalista", pais: "gt" }),
  canal("Fox Sports", "Deportes", { tema: "Deportes", pais: "mx" }),
];

describe("ida y vuelta", () => {
  it("reconstruye los campos que de verdad viajan", () => {
    const canales = desempaquetarCanales(empaquetarCanales(MUESTRA));
    expect(canales).toHaveLength(MUESTRA.length);
    for (const [i, esperado] of MUESTRA.entries()) {
      expect(canales[i].name).toBe(esperado.name);
      expect(canales[i].logoUrl).toBe(esperado.logoUrl);
      expect(canales[i].streamUrl).toBe(esperado.streamUrl);
    }
  });

  it("`category` llega con el TEMA, y el país se apunta aparte", () => {
    // Lo que las pantallas enseñan junto al canal: «Deportes», no la
    // categoría de numeración (que en la mitad de la lista decía
    // «Internacional»).
    const canales = desempaquetarCanales(empaquetarCanales(MUESTRA));
    expect(canales.map((c) => c.category)).toEqual(MUESTRA.map((c) => c.tema));
    expect(canales.map((c) => paisDe(c))).toEqual(MUESTRA.map((c) => c.pais));
  });

  it("sin campo nuevo en Channel: las claves son las de siempre", () => {
    const [reconstruido] = desempaquetarCanales(empaquetarCanales([MUESTRA[0]]));
    expect(Object.keys(reconstruido).sort()).toEqual(
      ["category", "id", "logoUrl", "name", "number", "streamUrl"].sort(),
    );
  });

  it("sin tema de la lista, lo saca del nombre", () => {
    const [reconstruido] = desempaquetarCanales(empaquetarCanales([canal("TUDN", "Deportes")]));
    expect(reconstruido.category).toBe("Deportes");
    expect(paisDe(reconstruido)).toBe("");
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

  it("el respaldo viaja sin guía en el quinto hueco", () => {
    const conRespaldo = [canal("ESPN", "Deportes", { streamUrlBackup: "https://b.test/espn.m3u8" })];
    const [empaquetado] = empaquetarCanales(conRespaldo).canales;
    expect(empaquetado).toHaveLength(5);
    expect(empaquetado[4]).toBe("https://b.test/espn.m3u8");
    const [reconstruido] = desempaquetarCanales(empaquetarCanales(conRespaldo));
    expect(reconstruido.streamUrlBackup).toBe("https://b.test/espn.m3u8");
  });

  it("guía y respaldo viajan juntos sin pisarse", () => {
    const ambos = [
      canal("ESPN", "Deportes", {
        currentProgram: "Partido",
        streamUrlBackup: "https://b.test/espn.m3u8",
      }),
    ];
    const [empaquetado] = empaquetarCanales(ambos).canales;
    expect(empaquetado).toHaveLength(6);
    const [reconstruido] = desempaquetarCanales(empaquetarCanales(ambos));
    expect(reconstruido.currentProgram).toBe("Partido");
    expect(reconstruido.streamUrlBackup).toBe("https://b.test/espn.m3u8");
  });

  it("sin respaldo no hay clave: el canal normal sigue en cuatro valores", () => {
    const [reconstruido] = desempaquetarCanales(empaquetarCanales([canal("X", "Deportes")]));
    expect("streamUrlBackup" in reconstruido).toBe(false);
  });
});

describe("la numeración: fijos de Guatemala y un bloque por región", () => {
  it("Canal 3 es el 3 y Canal 7 el 7; el resto, en el bloque de su región", () => {
    const canales = desempaquetarCanales(empaquetarCanales(MUESTRA));
    const porNombre = new Map(canales.map((c) => [c.name, c.number]));
    expect(porNombre.get("Canal 3")).toBe("3");
    expect(porNombre.get("Canal 7")).toBe("7");
    expect(porNombre.get("Canal 9")).toBe("30"); // resto de Guatemala
    expect(porNombre.get("Fox Sports")).toBe("300"); // México
    expect(porNombre.get("ESPN")).toBe("3000"); // Estados Unidos
  });

  it("el recorte del HTML trae los MISMOS números que la lista completa", () => {
    const paquete = empaquetarCanales(MUESTRA);
    const completa = desempaquetarCanales(paquete);
    const recorte = desempaquetarCanales(recortarPaquete(paquete, [2, 4]));
    expect(recorte.map((c) => c.number)).toEqual([completa[2].number, completa[4].number]);
  });
});

describe("las tablas: categorías, temas y pares", () => {
  it("guarda cada categoría, cada tema y cada par UNA vez, no uno por canal", () => {
    const paquete = empaquetarCanales(MUESTRA);
    expect(paquete.v).toBe(2);
    expect(paquete.categorias).toEqual(["Guatemala", "Deportes"]);
    expect(paquete.temas).toEqual(["Generalista", "Deportes"]);
    // Canal 3, 7 y 9 comparten par; ESPN y Fox Sports no (distinto país).
    expect(paquete.pares).toEqual([
      [0, "gt", 0],
      [1, "us", 1],
      [1, "mx", 1],
    ]);
    expect(paquete.canales.map((c) => c[1])).toEqual([0, 0, 1, 0, 2]);
    expect(paquete.cuentasPares).toEqual([3, 1, 1]);
  });

  it("no pierde una categoría que no esté en CATEGORY_ORDER", () => {
    // Una lista M3U ajena puede traer cualquier cosa; perderla al empaquetar
    // cambiaría el número del canal.
    const rara = [canal("Rareza", "Categoría Inventada")];
    const paquete = empaquetarCanales(rara);
    expect(paquete.categorias).toEqual(["Categoría Inventada"]);
    const [reconstruido] = desempaquetarCanales(paquete);
    // Sin país: al bloque «Sin país».
    expect(reconstruido.number).toBe("9000");
  });

  it("aguanta un índice fuera de rango sin reventar", () => {
    const roto: PaqueteCanales = {
      categorias: ["Guatemala"],
      cuentas: [1],
      total: 1,
      canales: [["X", 9, "l", "s"]],
    };
    expect(() => desempaquetarCanales(roto)).not.toThrow();
    expect(desempaquetarCanales(roto)[0].category).toBe("Otros");
    const rotoV2: PaqueteCanales = { ...roto, v: 2, temas: [], pares: [], cuentasPares: [] };
    expect(() => desempaquetarCanales(rotoV2)).not.toThrow();
  });
});

describe("el borde puede servir un paquete v1 a un JS nuevo", () => {
  /** Lo que mandaba el servidor antes: el hueco apunta a `categorias`. */
  const V1: PaqueteCanales = {
    categorias: ["Guatemala", "Deportes", "Internacional", "Entretenimiento"],
    cuentas: [2, 1, 1, 1],
    total: 5,
    canales: [
      ["Canal 3", 0, "l", "https://s.test/3"],
      ["Canal 7", 0, "l", "https://s.test/7"],
      ["ESPN", 1, "l", "https://s.test/espn"],
      ["NHK World News", 2, "l", "https://s.test/nhk"],
      ["Comedy Central", 3, "l", "https://s.test/cc"],
    ],
  };

  it("lo entiende: mismos ids, y numera con lo que sabe del país", () => {
    const canales = desempaquetarCanales(V1);
    expect(canales.map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
    // Un v1 solo sabe que Canal 3 y 7 son de Guatemala; el resto, sin país,
    // por nombre: Comedy Central, ESPN, NHK.
    expect(canales.map((c) => c.number)).toEqual(["3", "7", "9001", "9002", "9000"]);
  });

  it("y saca un tema razonable de la categoría vieja o del nombre", () => {
    const canales = desempaquetarCanales(V1);
    expect(canales.map((c) => c.category)).toEqual([
      "Otros",
      "Otros",
      "Deportes",
      // «Internacional» no es un tema: se pregunta al nombre.
      "Noticias",
      "Variedades",
    ]);
    // Lo único que un v1 sabe del país es la categoría Guatemala.
    expect(paisDe(canales[0])).toBe("gt");
    expect(paisDe(canales[2])).toBe("");
  });

  it("recortar un v1 sigue siendo un v1", () => {
    const recortado = recortarPaquete(V1, [0, 3]);
    expect(recortado.v).toBeUndefined();
    expect(desempaquetarCanales(recortado).map((c) => c.number)).toEqual(["3", "9002"]);
  });
});

/**
 * Una lista con la forma de la de verdad: ordenada por categoría de numeración,
 * como la deja `sortChannels`, con las doce categorías y tamaños desiguales, y
 * con temas y países repartidos como en la lista por defecto (mucho de fuera,
 * poco de Guatemala).
 */
const PAISES = ["us", "jp", "de", "", "ar", "co", "mx", "hn", "sv", "es", "do", "gt"];
const REALISTA = CATEGORY_ORDER.flatMap((categoria, i) =>
  Array.from({ length: 40 + i * 130 }, (_, n) =>
    canal(`${categoria} ${n}`, categoria, {
      tema: TEMAS[(n + i) % TEMAS.length],
      // Guatemala casi siempre de Guatemala; el resto, de cualquier sitio.
      pais: categoria === "Guatemala" && n % 5 !== 0 ? "gt" : PAISES[(n * 7 + i) % PAISES.length],
    }),
  ),
).concat(
  // Los de la casa, que en la lista real existen y viajan siempre.
  publicConfig.canalesDeCasa.map((nombre) =>
    canal(nombre, "General", { tema: "Generalista", pais: "gt" }),
  ),
);

const casa = normalizarCasa(publicConfig.canalesDeCasa);

describe("el recorte: mandar solo lo que se pinta", () => {
  const completo = empaquetarCanales(REALISTA);
  const recortado = recortarPaquete(completo, posicionesIniciales(completo, QUE_SE_PINTA));
  const todos = desempaquetarCanales(completo);
  const pocos = desempaquetarCanales(recortado);

  it("manda un puñado de canales, no la lista entera", () => {
    expect(REALISTA.length).toBeGreaterThan(7_000);
    // Seis secciones abiertas con su holgura y seis rieles de veinte, con
    // solapes: del orden de 200, como antes.
    expect(pocos.length).toBeLessThanOrEqual(6 * (QUE_SE_PINTA.porSeccion + 7) + 6 * 20);
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

  it("y el tema y el país", () => {
    const porNombre = new Map(todos.map((c) => [c.name, c]));
    for (const pocoCanal of pocos) {
      const deVerdad = porNombre.get(pocoCanal.name)!;
      expect(pocoCanal.category).toBe(deVerdad.category);
      expect(paisDe(pocoCanal)).toBe(paisDe(deVerdad));
    }
  });

  it("los recuentos siguen siendo los de la lista COMPLETA", () => {
    const recuentos = recuentosDe(recortado);
    for (const categoria of CATEGORY_ORDER) {
      const deVerdad = REALISTA.filter((c) => c.category === categoria).length;
      expect(recuentos.get(categoria)).toBe(deVerdad);
    }
    expect(recortado.total).toBe(REALISTA.length);
    expect(recortado.categorias).toEqual(completo.categorias);
    // Y por región y tema, que es lo que dice «Ver los N».
    const enSudamerica = REALISTA.filter((c) => c.pais === "ar" || c.pais === "co").length;
    expect(recuentos.get(claveDeRecuento("sudamerica", null))).toBe(enSudamerica);
    expect(recuentos.get(claveDeRecuento(null, null))).toBe(REALISTA.length);
    // Colgados de la lista, para Inicio, que recibe canales y no el paquete.
    expect(recuentosDeLista(pocos)?.get(claveDeRecuento("sudamerica", null))).toBe(enSudamerica);
  });

  it("Canales abre con las mismas cabezas de sección que con la lista entera", () => {
    const opciones = (canales: Channel[]) => ({
      filtro: "todo" as const,
      abierta: null,
      busqueda: "",
      deLaCasa: canalesDeCasa(canales),
      favoritos: [],
      recientes: [],
      caidos: new Set<number>(),
      porSeccion: QUE_SE_PINTA.porSeccion,
      recuentos: recuentosDe(completo),
    });
    const conTodo = filasDeCanales({ indice: indexarCanales(todos, casa), ...opciones(todos) });
    const conPocos = filasDeCanales({ indice: indexarCanales(pocos, casa), ...opciones(pocos) });
    expect(conPocos.map((f) => f.clave)).toEqual(conTodo.map((f) => f.clave));
  });

  it("Inicio pinta los mismos rieles, con los mismos canales y los mismos totales", () => {
    const rieles = (canales: Channel[]) =>
      rielesDeInicio(canales, fichaDe, casa, { porRiel: QUE_SE_PINTA.porGrupo }).map(
        ({ riel, items }) => ({ riel: riel.clave, ids: items.map((c) => c.id) }),
      );
    expect(rieles(pocos)).toEqual(rieles(todos));
  });

  it("los de la casa viajan aunque estén al final de la lista", () => {
    const nombres = new Set(pocos.map((c) => c.name));
    for (const nombre of publicConfig.canalesDeCasa) expect(nombres.has(nombre)).toBe(true);
  });

  it("el canal de arranque viaja aunque esté en mitad de la lista", () => {
    // `canalDeArranque` busca por nombre; si el preferido no viaja, la app
    // abriría con otro canal y luego NO se corregiría, porque al llegar la
    // lista completa ya hay uno sintonizado.
    const lejos = 5_000;
    const conExtra = recortarPaquete(
      completo,
      posicionesIniciales(completo, { ...QUE_SE_PINTA, ademas: [lejos] }),
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

  it("y pesa más de un orden de magnitud menos, que es el objetivo", () => {
    const antes = JSON.stringify(completo).length;
    const ahora = JSON.stringify(recortado).length;
    expect(ahora).toBeLessThan(antes / 10);
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
    // Con tema y país, como los deja hoy `m3u.ts`: los pares no pueden
    // comerse el ahorro de las tuplas.
    for (const [i, c] of muchos.entries()) {
      c.tema = TEMAS[i % TEMAS.length];
      c.pais = ["us", "gt", "mx", "hn", "es", "jp", "de", "ar"][i % 8];
    }
    const comoAhora = JSON.stringify(empaquetarCanales(muchos)).length;

    // No se afina el número exacto —depende de los datos— pero el orden de
    // magnitud sí importa y no debe empeorar nunca.
    expect(comoAhora).toBeLessThan(comoAntes * 0.65);
  });
});
