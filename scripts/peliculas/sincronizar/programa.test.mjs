import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ARCHIVO_ESTADO } from "./lib/automatico.mjs";

/**
 * El programa entero en modo automático, como lo lanza la tarea de Windows:
 * `node sincronizar.mjs --automatico`, con ffmpeg de verdad y un rclone falso
 * que apunta todo lo que se le pide. Sin ffmpeg, o en Windows (el rclone
 * falso es un guion con `#!`), se salta.
 */
const aqui = dirname(fileURLToPath(import.meta.url));
let hayFfmpeg = true;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  hayFfmpeg = false;
}

describe.skipIf(!hayFfmpeg || process.platform === "win32")("sincronizar.mjs --automatico (rclone falso)", () => {
  let base, carpeta, nube, registro, entorno;
  const viejo = new Date(Date.now() - 3600_000);
  const pelicula = (nombre) => {
    const ruta = join(carpeta, nombre);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", ruta]);
    utimesSync(ruta, viejo, viejo);
    return ruta;
  };
  const correr = (extra = {}) =>
    spawnSync(process.execPath, [join(aqui, "sincronizar.mjs"), "--automatico", "--carpeta", carpeta, "--aceleracion", "cpu"], {
      env: { ...entorno, ...extra },
      encoding: "utf8",
      // Sin teclado, como en la tarea programada.
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
  const catalogo = () => JSON.parse(readFileSync(join(nube, "peliculas", "catalogo.json"), "utf8")).peliculas;
  const ordenes = () => readFileSync(registro, "utf8").split("\n").filter(Boolean).map((l) => l.split(" ")[0]);
  const estado = () => readFileSync(join(carpeta, ARCHIVO_ESTADO), "utf8");

  beforeAll(() => {
    base = mkdtempSync(join(tmpdir(), "sincronizar-programa-"));
    carpeta = join(base, "Peliculas");
    nube = join(base, "nube");
    registro = join(base, "rclone.log");
    const bin = join(base, "bin");
    for (const d of [carpeta, nube, bin, join(base, "appdata", "CanalCasa")]) mkdirSync(d, { recursive: true });
    writeFileSync(join(bin, "rclone"), `#!/bin/sh\nexec "${process.execPath}" "${join(aqui, "pruebas", "rclone-falso.mjs")}" "$@"\n`);
    chmodSync(join(bin, "rclone"), 0o755);
    // La configuración, como la deja la primera sincronización a mano.
    writeFileSync(join(base, "appdata", "CanalCasa", "peliculas.json"), JSON.stringify({ Remoto: "r2", Cubo: "cubo", UrlPublica: "https://pub.ejemplo.r2.dev" }));
    entorno = {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH}`,
      APPDATA: join(base, "appdata"),
      LOCALAPPDATA: join(base, "localappdata"),
      RCLONE_FALSO_NUBE: nube,
      RCLONE_FALSO_REGISTRO: registro,
    };
    delete entorno.RCLONE_CONFIG_PASS;
    pelicula("Coco.2017.1080p.mkv");
  }, 60_000);
  afterAll(() => rmSync(base, { recursive: true, force: true }));

  it("sube la película nueva sin preguntar nada y lo deja escrito en la carpeta", () => {
    const r = correr();
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(catalogo().map((p) => p.titulo)).toEqual(["Coco"]);
    expect(existsSync(join(nube, "peliculas", catalogo()[0].carpeta, "master.m3u8"))).toBe(true);
    expect(estado()).toContain("+ Coco");
    // No se queda esperando un Enter.
    expect(r.stdout).not.toContain("Pulsa Enter");
    // Y la app puede ver cómo quedó el PC: nada en marcha, sin rutas.
    const publico = JSON.parse(readFileSync(join(nube, "peliculas", "estado.json"), "utf8"));
    expect(publico).toMatchObject({ version: 1, automatica: true, haciendo: null, pendientes: 0, fallo: false, limite: 10 * 1024 ** 3 });
    expect(Date.now() - Date.parse(publico.actualizado)).toBeLessThan(60_000);
    expect(publico.usado).toBeGreaterThan(0);
    expect(JSON.stringify(publico)).not.toContain(base);
  }, 90_000);

  it("una película descargándose (tocada hace menos de 2 minutos) no se toca", () => {
    const ruta = pelicula("Matrix.1999.mkv");
    utimesSync(ruta, new Date(), new Date());
    expect(correr().status).toBe(0);
    expect(catalogo().map((p) => p.titulo)).toEqual(["Coco"]);
    utimesSync(ruta, viejo, viejo);
    expect(correr().status).toBe(0);
    expect(catalogo().map((p) => p.titulo).sort()).toEqual(["Coco", "Matrix"]);
  }, 120_000);

  it("si una película desaparece de la carpeta, NO se borra de la nube: queda pendiente", () => {
    rmSync(join(carpeta, "Coco.2017.1080p.mkv"));
    writeFileSync(registro, "");
    const r = correr();
    expect(r.status).toBe(0);
    expect(catalogo().map((p) => p.titulo).sort()).toEqual(["Coco", "Matrix"]);
    expect(ordenes().filter((o) => o === "purge" || o === "deletefile")).toEqual([]);
    expect(estado()).toContain("PENDIENTE DE TI");
    expect(estado()).toContain("Coco");
    // Ni se marca «solo en la nube» por su cuenta: eso lo decide la persona.
    expect(catalogo().find((p) => p.titulo === "Coco").soloNube).toBeUndefined();
    expect(JSON.parse(readFileSync(join(nube, "peliculas", "estado.json"), "utf8"))).toMatchObject({ haciendo: null, pendientes: 1 });
  }, 60_000);

  it("si no cabe en el plan gratis, no la sube y lo dice", () => {
    pelicula("Up.2009.mkv");
    const r = correr({ RCLONE_FALSO_BYTES: String(10 * 1024 ** 3) });
    expect(r.status).toBe(0);
    expect(catalogo().map((p) => p.titulo)).not.toContain("Up");
    expect(estado()).toMatch(/Up.*no cabe/);
    rmSync(join(carpeta, "Up.2009.mkv"));
  }, 60_000);

  it("con la configuración de rclone cifrada y sin forma de obtener la contraseña, falla diciendo por qué", () => {
    const conf = join(base, "rclone.conf");
    writeFileSync(conf, "# Encrypted rclone configuration File\n\nRCLONE_ENCRYPT_V0:\nAAAA\n");
    const falso = join(base, "bin-cifrado");
    mkdirSync(falso, { recursive: true });
    writeFileSync(join(falso, "rclone"), `#!/bin/sh\nif [ "$1" = "config" ]; then echo "Configuration file is stored at:"; echo "${conf}"; exit 0; fi\nexec "${join(base, "bin", "rclone")}" "$@"\n`);
    chmodSync(join(falso, "rclone"), 0o755);
    const r = correr({ PATH: `${falso}${delimiter}${entorno.PATH}` });
    expect(r.status).toBe(1);
    expect(estado()).toContain("NO SE PUDO SINCRONIZAR");
    expect(estado()).toContain("RCLONE_PASSWORD_COMMAND");
  }, 30_000);

  it("si ya hay una sincronización en marcha, esta vuelta se retira sin tocar el estado", () => {
    const candado = join(base, "localappdata", "CanalCasa", "sincronizar.lock");
    writeFileSync(join(carpeta, ARCHIVO_ESTADO), "el de antes");
    writeFileSync(candado, String(process.pid));
    const antes = readFileSync(join(nube, "peliculas", "estado.json"), "utf8");
    const r = correr();
    expect(r.status).toBe(0);
    expect(estado()).toBe("el de antes");
    // Tampoco el de la app: la otra vuelta es la que cuenta por dónde va.
    expect(readFileSync(join(nube, "peliculas", "estado.json"), "utf8")).toBe(antes);
    rmSync(candado);
  }, 30_000);
});
