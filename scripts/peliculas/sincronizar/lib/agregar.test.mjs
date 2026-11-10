import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { agregarSubtitulos, agrupar, copiarALaBiblioteca, nombreDeSub } from "./agregar.mjs";
import { leerBiblioteca } from "./biblioteca.mjs";
import { crearDialogosFalsos } from "./windows.mjs";

let base, usb, raiz;
const viejo = new Date(Date.now() - 3600_000);
async function archivo(ruta, contenido = "x") {
  await writeFile(ruta, contenido);
  await utimes(ruta, viejo, viejo);
  return ruta;
}

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "agregar-"));
  usb = join(base, "USB");
  raiz = join(base, "Peliculas");
  await mkdir(usb, { recursive: true });
  await mkdir(raiz, { recursive: true });
});
afterEach(() => rm(base, { recursive: true, force: true }));

describe("agregar película desde otra carpeta", () => {
  it("copia el vídeo y su subtítulo (aunque no lo eligieras) y la biblioteca los empareja", async () => {
    const video = await archivo(join(usb, "Coco.2017.1080p.mkv"), "v".repeat(5000));
    await archivo(join(usb, "Coco.2017.1080p.es.srt"), "1\n");
    await archivo(join(usb, "Otra.es.srt"));
    const grupos = await agrupar([video]);
    expect(grupos[0].subtitulos.map((s) => s.split(/[\\/]/).pop())).toEqual(["Coco.2017.1080p.es.srt"]);

    const avances = [];
    const hechos = await copiarALaBiblioteca(grupos, raiz, { alAvance: (a) => avances.push(a) });
    expect(hechos).toEqual([{ video: "Coco.2017.1080p.mkv", subtitulos: ["Coco.2017.1080p.es.srt"], yaEstaba: false }]);
    expect(avances.at(-2)).toMatchObject({ porcentaje: 100 });
    expect(avances.at(-1)).toBeNull();
    // El original sigue donde estaba.
    expect(await readdir(usb)).toContain("Coco.2017.1080p.mkv");

    // Con la fecha del original: no parece «recién descargada».
    const { peliculas, saltadas } = await leerBiblioteca(raiz);
    expect(saltadas).toEqual([]);
    expect(peliculas).toHaveLength(1);
    expect(peliculas[0].titulo).toBe("Coco");
    expect(peliculas[0].subtitulos.map((s) => s.etiqueta)).toEqual(["Español"]);
  });

  it("un vídeo y un subtítulo con otro nombre: el subtítulo toma el nombre del vídeo", async () => {
    const video = await archivo(join(usb, "Up.mkv"));
    const sub = await archivo(join(usb, "spanish.srt"));
    const [g] = await agrupar([sub, video]);
    expect(g.subtitulos).toEqual([sub]);
    await copiarALaBiblioteca([g], raiz);
    expect((await readdir(raiz)).sort()).toEqual(["Up.mkv", "Up.spanish.srt"]);
  });

  it("no sobrescribe: el mismo archivo se reconoce; otro con el mismo nombre va a « (2)»", async () => {
    await archivo(join(raiz, "Up.mkv"), "uno");
    const igual = await archivo(join(usb, "Up.mkv"), "uno");
    expect((await copiarALaBiblioteca(await agrupar([igual]), raiz))[0].yaEstaba).toBe(true);
    await rm(igual);
    const otro = await archivo(join(usb, "Up.mkv"), "otro distinto");
    expect((await copiarALaBiblioteca(await agrupar([otro]), raiz))[0].video).toBe("Up (2).mkv");
  });

  it("solo subtítulos, sin película: lo dice en vez de copiar nada", async () => {
    await expect(agrupar([join(usb, "a.srt")])).rejects.toThrow(/Elige también la película/);
    await expect(agrupar([])).rejects.toThrow(/No elegiste/);
  });

  it("+ Subtítulo: al lado del vídeo con su nombre, o dentro de su carpeta, sin pisar", async () => {
    const suelto = await archivo(join(raiz, "Coco.mkv"));
    const sub = await archivo(join(usb, "es.srt"));
    expect(await agregarSubtitulos([sub], suelto, raiz)).toEqual(["Coco.es.srt"]);
    expect(await agregarSubtitulos([sub], suelto, raiz)).toEqual(["Coco.es.2.srt"]);
    await mkdir(join(raiz, "Dune"));
    const enCarpeta = await archivo(join(raiz, "Dune", "x.mkv"));
    expect(await agregarSubtitulos([sub], enCarpeta, raiz)).toEqual(["es.srt"]);
  });

  it("nombreDeSub cambia solo la base", () => {
    expect(nombreDeSub("/u/Coco.2017.es.srt", "Coco.2017", "Coco (2)")).toBe("Coco (2).es.srt");
    expect(nombreDeSub("/u/Coco.es.srt", null, "Coco")).toBe("Coco.es.srt");
  });
});

describe("diálogos falsos (para probar sin Windows)", () => {
  it("la «papelera» mueve, no borra", async () => {
    const json = join(base, "dialogos.json");
    await writeFile(json, JSON.stringify({ archivos: ["/a.mkv"], papelera: join(base, "papelera") }));
    const d = crearDialogosFalsos(json);
    expect(await d.elegirPeliculas()).toEqual(["/a.mkv"]);
    const v = await archivo(join(raiz, "Coco.mkv"));
    expect(await d.aPapelera([v, join(raiz, "no-existe.mkv")])).toEqual([v]);
    expect(await readdir(raiz)).toEqual([]);
    expect((await readdir(join(base, "papelera")))[0]).toMatch(/Coco\.mkv$/);
  });
});
