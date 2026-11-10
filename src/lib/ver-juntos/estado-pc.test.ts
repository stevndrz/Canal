import { describe, expect, it } from "vitest";
import { fraseDelPc, hace, leerEstadoPc, rutaEstadoPc } from "./estado-pc";

const AHORA = Date.parse("2026-11-10T20:00:00Z");
const hacia = (min: number) => new Date(AHORA - min * 60_000).toISOString();
const GB = 1024 ** 3;
/** Como lo escribe el PC. */
const delPc = (extra: Record<string, unknown> = {}) => ({
  version: 1,
  actualizado: hacia(5),
  automatica: true,
  haciendo: null,
  usado: 7.2 * GB,
  limite: 10 * GB,
  pendientes: 0,
  fallo: false,
  ...extra,
});
const frase = (extra?: Record<string, unknown>) => fraseDelPc(leerEstadoPc(delPc(extra)), AHORA);

describe("leerEstadoPc", () => {
  it("lee lo que escribe el sincronizador", () => {
    expect(leerEstadoPc(delPc({ haciendo: { fase: "convertir", titulo: "Buddy", porcentaje: 62 } }))).toEqual({
      actualizado: AHORA - 5 * 60_000,
      automatica: true,
      haciendo: { fase: "convertir", titulo: "Buddy", porcentaje: 62 },
      usado: 7.2 * GB,
      limite: 10 * GB,
      pendientes: 0,
      fallo: false,
    });
  });

  it("descarta lo que no tiene forma de estado", () => {
    for (const malo of [null, "hola", [], {}, { actualizado: "ayer" }, { actualizado: 5 }]) expect(leerEstadoPc(malo)).toBeNull();
  });

  it("no se fía de los campos sueltos", () => {
    const e = leerEstadoPc(delPc({ haciendo: { fase: "borrar", titulo: "x" }, usado: "mucho", limite: -1, pendientes: "3", fallo: "sí" }));
    expect(e).toMatchObject({ haciendo: null, usado: null, limite: null, pendientes: 0, fallo: false });
    expect(leerEstadoPc(delPc({ haciendo: { fase: "subir", titulo: "  ", porcentaje: 3 } }))?.haciendo).toBeNull();
    expect(leerEstadoPc(delPc({ haciendo: { fase: "subir", titulo: "Coco", porcentaje: 250 } }))?.haciendo?.porcentaje).toBe(100);
    expect(leerEstadoPc(delPc({ haciendo: { fase: "convertir", titulo: "Coco", porcentaje: null } }))?.haciendo?.porcentaje).toBeNull();
  });

  it("la ruta cuelga del mismo bucket que el catálogo", () => {
    expect(rutaEstadoPc("https://pub-x.r2.dev")).toBe("https://pub-x.r2.dev/peliculas/estado.json");
  });
});

describe("fraseDelPc", () => {
  it("sin estado no dice nada", () => {
    expect(fraseDelPc(null, AHORA)).toBeNull();
  });

  it("al día: cuándo y cuánto ocupa", () => {
    expect(frase()).toEqual({ texto: "Sincronizado hace 5 min · 7,2 de 10 GB", tono: "normal" });
    expect(frase({ usado: null })?.texto).toBe("Sincronizado hace 5 min");
  });

  it("trabajando: qué y por dónde va", () => {
    expect(frase({ actualizado: hacia(0), haciendo: { fase: "convertir", titulo: "Buddy", porcentaje: 62 } })).toEqual({
      texto: "Convirtiendo «Buddy» · 62 %",
      tono: "activo",
    });
    expect(frase({ actualizado: hacia(1), haciendo: { fase: "subir", titulo: "Buddy", porcentaje: 0 } })?.texto).toBe("Subiendo «Buddy» · 0 %");
    // Sin duración conocida no hay porcentaje que enseñar.
    expect(frase({ actualizado: hacia(1), haciendo: { fase: "convertir", titulo: "Buddy", porcentaje: null } })?.texto).toBe("Convirtiendo «Buddy»");
  });

  it("si el PC se calló a media película, no se enseña como si siguiera", () => {
    expect(frase({ actualizado: hacia(125), haciendo: { fase: "convertir", titulo: "Buddy", porcentaje: 62 } })).toEqual({
      texto: "El PC se quedó convirtiendo «Buddy» · 62 % hace 2 h. Seguirá al encenderlo.",
      tono: "aviso",
    });
  });

  it("lo que espera al dueño y los fallos se dicen", () => {
    expect(frase({ pendientes: 1 })).toEqual({ texto: "Sincronizado hace 5 min · 7,2 de 10 GB · 1 cosa por decidir en el PC", tono: "aviso" });
    expect(frase({ pendientes: 3 })?.texto).toContain("3 cosas por decidir en el PC");
    expect(frase({ fallo: true, usado: null })).toEqual({ texto: "La última sincronización falló (hace 5 min)", tono: "aviso" });
  });

  it("un reloj adelantado en el PC no da tiempos negativos", () => {
    expect(frase({ actualizado: hacia(-30), usado: null })?.texto).toBe("Sincronizado ahora mismo");
  });
});

describe("hace", () => {
  it("de minutos a días", () => {
    expect([20_000, 5 * 60_000, 59 * 60_000, 3 * 3600_000, 30 * 3600_000, 72 * 3600_000].map(hace)).toEqual([
      "ahora mismo",
      "hace 5 min",
      "hace 59 min",
      "hace 3 h",
      "ayer",
      "hace 3 días",
    ]);
  });
});
