import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { crearDialogosFalsos } from "./lib/windows.mjs";
import { crearPanel } from "./panel.mjs";
import { crearNubeLocal } from "./pruebas/nube-local.mjs";

let hayFfmpeg = true;
try {
  execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
} catch {
  hayFfmpeg = false;
}

let base, raiz, usb, nube, panel, url, puerto;
const viejo = new Date(Date.now() - 3600_000);

/** Una petición a mano, para poder mandar el Host/Origin que se quiera. */
function pedir(ruta, { metodo = "GET", cuerpo, token = panel.token, origen, host } = {}) {
  return new Promise((resolver, rechazar) => {
    const datos = cuerpo === undefined ? null : JSON.stringify(cuerpo);
    const req = request(
      {
        host: "127.0.0.1",
        port: puerto,
        path: ruta,
        method: metodo,
        headers: {
          Host: host ?? `127.0.0.1:${puerto}`,
          ...(token ? { "X-Token": token } : {}),
          ...(origen ? { Origin: origen } : {}),
          ...(datos ? { "Content-Type": "application/json" } : {}),
        },
      },
      (res) => {
        let texto = "";
        res.on("data", (t) => (texto += t));
        res.on("end", () => resolver({ codigo: res.statusCode, datos: texto.startsWith("{") ? JSON.parse(texto) : texto }));
      },
    );
    req.on("error", rechazar);
    req.end(datos ?? undefined);
  });
}
const estado = async () => (await pedir("/api/estado")).datos;
async function hastaLibre() {
  for (let i = 0; i < 300; i++) {
    const e = await estado();
    if (!e.ocupado) return e;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("El panel no terminó");
}

describe.skipIf(!hayFfmpeg)("panel (ffmpeg real, nube local, diálogos falsos)", () => {
  beforeAll(async () => {
    base = await mkdtemp(join(tmpdir(), "panel-"));
    raiz = join(base, "Peliculas");
    usb = join(base, "USB");
    await mkdir(raiz, { recursive: true });
    await mkdir(usb, { recursive: true });
    nube = crearNubeLocal(join(base, "nube"));
    execFileSync("ffmpeg", [
      "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24:duration=3",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-metadata:s:a:0", "language=spa",
      join(usb, "Coco.2017.1080p.WEB-DL.mkv"),
    ]);
    await writeFile(join(usb, "Coco.2017.1080p.WEB-DL.es.srt"), "1\n00:00:00,500 --> 00:00:02,000\nHola\n");
    for (const n of await readdir(usb)) await utimes(join(usb, n), viejo, viejo);
    const json = join(base, "dialogos.json");
    await writeFile(json, JSON.stringify({ archivos: [join(usb, "Coco.2017.1080p.WEB-DL.mkv")], papelera: join(base, "papelera") }));

    panel = crearPanel({
      registro: { ruta: join(base, "registro.txt"), registrar: () => {} },
      leerConfig: () => ({ remoto: "r2", cubo: "c", urlPublica: "https://pub.ejemplo.r2.dev", carpeta: raiz }),
      guardarConfig: () => {},
      crearNube: () => nube,
      dialogos: crearDialogosFalsos(json),
      faltaPrograma: () => null,
      rcloneCifrado: () => false,
      capacidades: () => ({ probarCodificador: () => false, hayZscale: true }),
      tomarCandado: () => () => {},
      trabajo: () => join(base, "trabajo"),
      html: () => "<h1>panel</h1>",
    });
    await mkdir(join(base, "trabajo"), { recursive: true });
    url = await panel.iniciar(0);
    puerto = Number(new URL(url).port);
  }, 60_000);
  afterAll(async () => {
    panel?.cerrar();
    await rm(base, { recursive: true, force: true });
  });

  it("sin token, con otro Origin o con otro Host: nada", async () => {
    expect((await pedir("/api/estado", { token: null })).codigo).toBe(403);
    expect((await pedir("/api/estado", { token: "mal" })).codigo).toBe(403);
    expect((await pedir("/api/borrar", { metodo: "POST", cuerpo: {}, origen: "https://malo.example" })).codigo).toBe(403);
    expect((await pedir("/api/estado", { host: "malo.example" })).codigo).toBe(403);
    expect((await pedir(`/?t=${panel.token}`, { token: null })).codigo).toBe(200);
  });

  it("agregar copia desde otra carpeta, subir la pone en la app y borrar la quita de las dos", async () => {
    expect((await estado()).peliculas).toEqual([]);

    const agregado = await pedir("/api/agregar", { metodo: "POST", cuerpo: {} });
    expect(agregado.codigo).toBe(200);
    expect(agregado.datos.hechos[0]).toMatchObject({ video: "Coco.2017.1080p.WEB-DL.mkv", subtitulos: ["Coco.2017.1080p.WEB-DL.es.srt"] });
    let e = await estado();
    expect(e.peliculas).toMatchObject([{ titulo: "Coco", estado: "por-subir", subtitulosPc: ["Español"] }]);
    expect(e.pendientes).toBe(1);

    expect((await pedir("/api/sincronizar", { metodo: "POST", cuerpo: {} })).codigo).toBe(202);
    e = await hastaLibre();
    expect(e.peliculas).toMatchObject([{ titulo: "Coco", estado: "al-dia", enNube: true, id: "coco" }]);
    expect(e.historial.map((m) => m.texto)).toContain("«Coco» subida.");
    expect(await nube.leerCatalogo()).toHaveLength(1);
    // La app ve cómo quedó el PC.
    expect(JSON.parse(await readFile(join(base, "nube", "peliculas", "estado.json"), "utf8"))).toMatchObject({ haciendo: null, automatica: false, fallo: false });

    const borrado = await pedir("/api/borrar", { metodo: "POST", cuerpo: { clave: "nube:coco" } });
    expect(borrado.codigo).toBe(200);
    e = await estado();
    expect(e.peliculas).toEqual([]);
    expect(await nube.leerCatalogo()).toEqual([]);
    expect(await nube.listarCarpetas()).toEqual([]);
    expect(await readdir(raiz)).toEqual([]);
    expect((await readdir(join(base, "papelera"))).length).toBe(2);
    // El original del USB, intacto.
    expect((await readdir(usb)).length).toBe(2);
  }, 60_000);

  it("una clave que no existe no borra nada", async () => {
    const r = await pedir("/api/borrar", { metodo: "POST", cuerpo: { clave: "pc:../../etc" } });
    expect(r.codigo).toBe(404);
  });
});
