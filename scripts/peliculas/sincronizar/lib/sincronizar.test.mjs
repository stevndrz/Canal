import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, rename, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearNubeLocal } from "../pruebas/nube-local.mjs";
import { sincronizar } from "./sincronizar.mjs";

/**
 * De punta a punta con ffmpeg de verdad y una nube que es una carpeta: la
 * vida entera de una película. Sin ffmpeg en la máquina, se salta.
 */
let hayFfmpeg = true;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  hayFfmpeg = false;
}

function ejecutar(programa, args, { cwd } = {}) {
  return new Promise((resolver) => {
    const hijo = spawn(programa, args, { cwd });
    let salida = "";
    let error = "";
    hijo.stdout.on("data", (d) => (salida += d));
    hijo.stderr.on("data", (d) => (error += d));
    hijo.on("close", (codigo) => resolver({ codigo, salida, error }));
  });
}

const viejo = new Date(Date.now() - 3600_000);
let base, raiz, trabajo, nube;
const mensajes = [];
const decir = (tipo, texto) => mensajes.push(`${tipo}: ${texto}`);
const siempre = (respuesta) => async () => respuesta;
const correr = (preguntar = siempre(true)) =>
  sincronizar({ raiz, trabajo, nube, ejecutar, preguntar, decir, opciones: { probarCodificador: () => false } });

async function tocarViejo(ruta) {
  await utimes(ruta, viejo, viejo);
}

describe.skipIf(!hayFfmpeg)("sincronizar (ffmpeg real, nube local)", () => {
  beforeAll(async () => {
    base = await mkdtemp(join(tmpdir(), "sincronizar-"));
    raiz = join(base, "Peliculas");
    trabajo = join(base, "trabajo");
    await mkdir(raiz, { recursive: true });
    await mkdir(trabajo, { recursive: true });
    nube = crearNubeLocal(join(base, "nube"));
    // Una película de 3 s: H.264 (se copia), dos audios (inglés y español) y
    // un subtítulo inglés dentro del MKV.
    const srtDentro = join(base, "dentro.srt");
    await writeFile(srtDentro, "1\n00:00:00,500 --> 00:00:02,000\nHello\n");
    execFileSync("ffmpeg", [
      "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=3",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
      "-f", "lavfi", "-i", "sine=frequency=660:duration=3",
      "-i", srtDentro,
      "-map", "0", "-map", "1", "-map", "2", "-map", "3",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-c:s", "srt",
      "-metadata:s:a:0", "language=eng", "-metadata:s:a:1", "language=spa", "-metadata:s:s:0", "language=eng",
      join(raiz, "Coco.2017.1080p.WEB-DL.mkv"),
    ]);
    await tocarViejo(join(raiz, "Coco.2017.1080p.WEB-DL.mkv"));
  }, 60_000);
  afterAll(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it("sube la película nueva con sus audios y subtítulos, y la apunta en el catálogo", async () => {
    const r = await correr();
    expect(r.fallidas).toBe(0);
    const [coco] = await nube.leerCatalogo();
    expect(coco).toMatchObject({ id: "coco", titulo: "Coco", carpeta: expect.stringMatching(/^coco-[0-9a-f]{6}$/), duracion: 3 });
    expect(coco.url).toBe(`https://pub.ejemplo.r2.dev/peliculas/${coco.carpeta}/master.m3u8`);
    const maestra = await readFile(join(base, "nube", "peliculas", coco.carpeta, "master.m3u8"), "utf8");
    // El español primero (audio principal) y con su nombre de verdad.
    expect(maestra).toMatch(/NAME="Español"[^\n]*DEFAULT=YES/);
    expect(maestra).toContain('NAME="Inglés"');
    expect(coco.subtitulos.map((s) => s.label)).toEqual(["Inglés"]);
    expect(await nube.existe(`peliculas/${coco.carpeta}/a0/index.m3u8`)).toBe(true);
    // Nada a medias en el disco del PC.
    expect(await (await import("node:fs/promises")).readdir(trabajo)).toEqual([]);
  }, 60_000);

  it("una segunda vuelta sin cambios no hace nada", async () => {
    const antes = nube.escrituras;
    const r = await correr();
    expect(r.plan).toEqual([]);
    expect(nube.escrituras).toBe(antes);
  });

  it("un .srt suelto en Windows-1252 se sube solo (sin reconvertir la película) y con los acentos bien", async () => {
    const srt = join(raiz, "Coco.2017.1080p.WEB-DL.Spanish.Latino.srt");
    await writeFile(srt, Buffer.from("1\n00:00:00,500 --> 00:00:02,000\nNi\xf1o, \xa1hola!\n", "latin1"));
    const r = await correr();
    expect(r.plan.map((a) => a.tipo)).toEqual(["subtitulos"]);
    const [coco] = await nube.leerCatalogo();
    const latino = coco.subtitulos.find((s) => s.label === "Español latino");
    expect(latino.origen.archivo).toBe("Coco.2017.1080p.WEB-DL.Spanish.Latino.srt");
    const vtt = await readFile(join(base, "nube", latino.url.replace("https://pub.ejemplo.r2.dev/", "")), "utf8");
    expect(vtt).toContain("Niño, ¡hola!");
  }, 60_000);

  it("borrar el .srt de la carpeta lo quita de la nube; el de dentro del vídeo se queda", async () => {
    await rm(join(raiz, "Coco.2017.1080p.WEB-DL.Spanish.Latino.srt"));
    await correr();
    const [coco] = await nube.leerCatalogo();
    expect(coco.subtitulos.map((s) => s.label)).toEqual(["Inglés"]);
  });

  it("meterla en su carpeta con otro nombre la renombra, sin volver a subirla", async () => {
    const [antes] = await nube.leerCatalogo();
    await mkdir(join(raiz, "Coco (doblaje latino)"));
    await rename(join(raiz, "Coco.2017.1080p.WEB-DL.mkv"), join(raiz, "Coco (doblaje latino)", "coco.mkv"));
    const r = await correr();
    expect(r.plan.map((a) => a.tipo)).toEqual(["renombrar"]);
    const [despues] = await nube.leerCatalogo();
    expect(despues.titulo).toBe("Coco (doblaje latino)");
    expect(despues.carpeta).toBe(antes.carpeta);
  });

  it("si la película ya no está en la carpeta, pregunta; con «no» y «que se quede», no borra ni vuelve a preguntar", async () => {
    await rename(join(raiz, "Coco (doblaje latino)"), join(base, "fuera"));
    const preguntas = [];
    await correr(async (texto, porDefecto) => {
      preguntas.push(texto);
      return porDefecto;
    });
    expect(preguntas.some((p) => /BORRO de la nube/.test(p))).toBe(true);
    const [coco] = await nube.leerCatalogo();
    expect(coco.soloNube).toBe(true);
    const otra = await correr(siempre(true));
    expect(otra.plan).toEqual([]);
  });

  it("si vuelve a la carpeta, se reconoce; y si se quita y se dice «sí», se borra de la nube", async () => {
    await rename(join(base, "fuera"), join(raiz, "Coco (doblaje latino)"));
    const vuelta = await correr();
    expect(vuelta.plan).toEqual([]);
    const [marcada] = await nube.leerCatalogo();
    marcada.soloNube = false;
    await nube.escribirCatalogo([marcada]);
    await rm(join(raiz, "Coco (doblaje latino)"), { recursive: true });
    const [coco] = await nube.leerCatalogo();
    await correr(siempre(true));
    expect(await nube.leerCatalogo()).toEqual([]);
    expect(await nube.existe(`peliculas/${coco.carpeta}`)).toBe(false);
  });
});
