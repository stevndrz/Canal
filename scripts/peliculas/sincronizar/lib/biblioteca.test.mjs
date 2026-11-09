import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { leerBiblioteca } from "./biblioteca.mjs";

let raiz;
const AHORA = Date.now();
const viejo = new Date(AHORA - 60 * 60_000);

async function archivo(ruta, contenido = "x", reciente = false) {
  await mkdir(join(raiz, ruta, ".."), { recursive: true });
  await writeFile(join(raiz, ruta), contenido);
  if (!reciente) await utimes(join(raiz, ruta), viejo, viejo);
}

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), "biblioteca-"));
});
afterEach(async () => {
  await rm(raiz, { recursive: true, force: true });
});

describe("leerBiblioteca", () => {
  it("lee películas sueltas con sus subtítulos, y en su carpeta", async () => {
    await archivo("Interstellar (2014).mkv", "video-interstellar");
    await archivo("Interstellar (2014).es.srt", "1\n00:00:01,000 --> 00:00:02,000\nHola\n");
    await archivo("Interstellar (2014).en.forced.srt", "sub en");
    await archivo("Otra cosa.srt", "no es de nadie");
    await archivo("Coco/coco.2017.1080p.web.mkv", "video-coco-grande-grande");
    await archivo("Coco/sample.mkv", "muestra");
    await archivo("Coco/Coco.Spanish.Latino.srt", "sub coco");
    await archivo("subidas/the-hunger-games-catching-fire.mkv", "video-catching");

    const { peliculas, saltadas } = await leerBiblioteca(raiz, { ahora: AHORA });
    const porId = Object.fromEntries(peliculas.map((p) => [p.id, p]));
    expect(Object.keys(porId).sort()).toEqual(["coco", "interstellar", "the-hunger-games-catching-fire"]);

    expect(porId.interstellar.anio).toBe(2014);
    expect(porId.interstellar.subtitulos.map((s) => s.etiqueta).sort()).toEqual(["Español", "Inglés (forzados)"]);
    expect(porId.coco.video.nombre).toBe("coco.2017.1080p.web.mkv");
    expect(porId.coco.subtitulos.map((s) => s.etiqueta)).toEqual(["Español latino"]);
    expect(porId["the-hunger-games-catching-fire"].subtitulos).toEqual([]);
    expect(saltadas).toEqual([]);
  });

  it("no toca lo que se está descargando", async () => {
    await archivo("Nueva.2024.mkv", "aun bajando", true);
    await archivo("Otra.2024.mkv.part", "a medias");
    const { peliculas, saltadas } = await leerBiblioteca(raiz, { ahora: AHORA });
    expect(peliculas).toEqual([]);
    expect(saltadas.map((s) => s.motivo)).toEqual(
      expect.arrayContaining([expect.stringMatching(/copiando o descargando/), "descarga a medias"]),
    );
  });

  it("la huella cambia si el archivo cambia, y no si solo se renombra", async () => {
    await archivo("A.mkv", "contenido uno");
    const [a] = (await leerBiblioteca(raiz, { ahora: AHORA })).peliculas;
    await rm(join(raiz, "A.mkv"));
    await archivo("B.mkv", "contenido uno");
    const [b] = (await leerBiblioteca(raiz, { ahora: AHORA })).peliculas;
    expect(b.video.huella).toBe(a.video.huella);
    await archivo("B.mkv", "contenido dos");
    const [c] = (await leerBiblioteca(raiz, { ahora: AHORA })).peliculas;
    expect(c.video.huella).not.toBe(a.video.huella);
  });

  it("dos copias de la misma película: se queda la más grande y se avisa", async () => {
    await archivo("Coco.2017.720p.mkv", "pequeña");
    await archivo("Coco (2017).mkv", "la grande, la buena");
    const { peliculas, saltadas } = await leerBiblioteca(raiz, { ahora: AHORA });
    expect(peliculas).toHaveLength(1);
    expect(peliculas[0].video.nombre).toBe("Coco (2017).mkv");
    expect(saltadas[0].motivo).toMatch(/otra copia/);
  });
});
