import { describe, expect, it } from "vitest";
import { crearEstadoPublico } from "./estado-publico.mjs";

/** Una nube que solo apunta lo que le escriben. */
function nubeFalsa({ falla = false, usado = 3_000 } = {}) {
  const escritos = [];
  return {
    escritos,
    async escribirEstado(e) {
      if (falla) throw new Error("sin red");
      escritos.push(structuredClone(e));
    },
    async tamanoTotal() {
      return usado;
    },
  };
}
const calma = () => new Promise((r) => setTimeout(r, 5));

describe("el estado del PC para la app", () => {
  it("cuenta qué convierte y su porcentaje, a saltos de 5 puntos y no en cada línea", async () => {
    const nube = nubeFalsa();
    let reloj = Date.parse("2026-11-10T20:00:00Z");
    const publico = crearEstadoPublico({ nube, limite: 10_000, automatica: true, ahora: () => reloj });
    publico.fase({ fase: "convertir", titulo: "Buddy", duracion: 100 });
    await calma();
    for (const s of [1, 2, 3, 4, 6, 7, 30, 31, 62]) {
      publico.leer(`frame=1 time=00:00:${String(s).padStart(2, "0")}.00 bitrate=1\r`);
      await calma();
    }
    expect(nube.escritos.map((e) => e.haciendo.porcentaje)).toEqual([0, 6, 30, 62]);
    expect(nube.escritos.at(-1)).toEqual({
      version: 1,
      actualizado: "2026-11-10T20:00:00.000Z",
      automatica: true,
      haciendo: { fase: "convertir", titulo: "Buddy", porcentaje: 62 },
      usado: null,
      limite: 10_000,
      pendientes: 0,
      fallo: false,
    });

    // Otra fase se cuenta enseguida, aunque el porcentaje sea menor.
    publico.fase({ fase: "subir", titulo: "Buddy" });
    await calma();
    publico.leer("Transferred:   1.2 GiB / 3.4 GiB, 35%, 10 MiB/s, ETA 3m\n");
    await calma();
    expect(nube.escritos.slice(-2).map((e) => [e.haciendo.fase, e.haciendo.porcentaje])).toEqual([["subir", 0], ["subir", 35]]);

    // Con el porcentaje quieto, al minuto se repite: se ve que sigue vivo.
    const antes = nube.escritos.length;
    publico.leer("Transferred:   1.2 GiB / 3.4 GiB, 36%, 10 MiB/s, ETA 3m\n");
    await calma();
    expect(nube.escritos.length).toBe(antes);
    reloj += 61_000;
    publico.leer("Transferred:   1.3 GiB / 3.4 GiB, 37%, 10 MiB/s, ETA 3m\n");
    await calma();
    expect(nube.escritos.at(-1).haciendo.porcentaje).toBe(37);
  });

  it("al terminar: nada en marcha, lo que ocupa la nube y lo que espera al dueño", async () => {
    const nube = nubeFalsa({ usado: 7_200 });
    const publico = crearEstadoPublico({ nube, limite: 10_000 });
    publico.fase({ fase: "subir", titulo: "Coco" });
    publico.fase(null);
    await publico.fin({ pendientes: 2, fallo: true });
    expect(nube.escritos.at(-1)).toMatchObject({ haciendo: null, usado: 7_200, limite: 10_000, pendientes: 2, fallo: true, automatica: false });
  });

  it("una vuelta sin nada que hacer también deja su hora (es el latido)", async () => {
    const nube = nubeFalsa();
    await crearEstadoPublico({ nube, limite: 1, ahora: () => Date.parse("2026-11-10T21:30:00Z") }).fin();
    expect(nube.escritos).toHaveLength(1);
    expect(nube.escritos[0]).toMatchObject({ actualizado: "2026-11-10T21:30:00.000Z", haciendo: null, fallo: false });
  });

  it("si no se puede escribir, se apunta y la sincronización sigue", async () => {
    const dicho = [];
    const publico = crearEstadoPublico({ nube: nubeFalsa({ falla: true }), limite: 1, registrar: (t) => dicho.push(t) });
    publico.fase({ fase: "subir", titulo: "Coco" });
    await calma();
    await expect(publico.fin()).resolves.toBeUndefined();
    expect(dicho.join(" ")).toMatch(/No pude publicar el estado del PC: sin red/);
  });

  it("no lleva nada del PC: ni rutas ni mensajes de error", async () => {
    const nube = nubeFalsa();
    const publico = crearEstadoPublico({ nube, limite: 1 });
    publico.fase({ fase: "convertir", titulo: "Coco", duracion: 10, ruta: "C:\\Users\\Steven\\Downloads\\Peliculas\\Coco.mkv" });
    await calma();
    await publico.fin({ fallo: true, error: "ENOENT C:\\Users\\Steven" });
    expect(JSON.stringify(nube.escritos)).not.toMatch(/Users|Steven|ENOENT/);
  });
});
