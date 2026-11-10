import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { leerBiblioteca } from "./biblioteca.mjs";
import { descargarALaBiblioteca, leerEnlace, nombreDeCabecera, nombreDeDescarga, nombreSeguro } from "./descargar.mjs";

/** 300 KB que no se repiten: si un trozo se pega mal, el contenido no coincide. */
const PELICULA = Buffer.alloc(300_000);
for (let i = 0; i < PELICULA.length; i++) PELICULA[i] = (i * 31 + (i >> 8)) & 255;

/**
 * Un servidor de descargas de mentira. Cada ruta, un comportamiento; `cortes`
 * dice cuántas veces más va a colgar a media descarga.
 */
let servidor, base, raiz;
let cortes = 0;
let pedidos = [];
let contenido = PELICULA;
let etiqueta = '"v1"';

function servirArchivo(req, res, { rangos = true, cabeceras = {} } = {}) {
  const total = contenido.length;
  const rango = /^bytes=(\d+)-$/.exec(req.headers.range ?? "");
  const vale = !req.headers["if-range"] || req.headers["if-range"] === etiqueta;
  const desde = rangos && rango && vale ? Number(rango[1]) : 0;
  if (desde >= total) return res.writeHead(416, { "Content-Range": `bytes */${total}` }).end();
  const comunes = { "Content-Type": "video/x-matroska", ETag: etiqueta, ...(rangos ? { "Accept-Ranges": "bytes" } : {}), ...cabeceras };
  if (desde > 0) res.writeHead(206, { ...comunes, "Content-Range": `bytes ${desde}-${total - 1}/${total}`, "Content-Length": total - desde });
  else res.writeHead(200, { ...comunes, "Content-Length": total });
  if (cortes > 0) {
    cortes -= 1;
    // Manda un tercio de lo que falta y cuelga, como un wifi que se cae.
    // (con un respiro: colgar en seco tira también lo que iba de camino).
    res.write(contenido.subarray(desde, desde + Math.floor((total - desde) / 3)), () => setTimeout(() => res.destroy(), 60));
    return;
  }
  res.end(contenido.subarray(desde));
}

beforeAll(async () => {
  servidor = createServer((req, res) => {
    const ruta = new URL(req.url, "http://x").pathname;
    pedidos.push({ ruta, rango: req.headers.range ?? null });
    if (ruta === "/pelis/Coco.2017.1080p.mkv") return servirArchivo(req, res);
    if (ruta === "/sin-rangos/Coco.mkv") return servirArchivo(req, res, { rangos: false });
    if (ruta === "/descargar") return servirArchivo(req, res, { cabeceras: { "Content-Disposition": "attachment; filename*=UTF-8''El%20ni%C3%B1o%20y%20la%20garza.mkv" } });
    if (ruta === "/trampa") return servirArchivo(req, res, { cabeceras: { "Content-Disposition": 'attachment; filename="..\\..\\Inicio\\malo.mkv"' } });
    if (ruta === "/ir") return res.writeHead(302, { Location: "/pelis/Coco.2017.1080p.mkv" }).end();
    if (ruta === "/pagina/Coco.mkv") return res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end("<html><body>Pulsa para descargar</body></html>");
    if (ruta === "/archivo.zip") return res.writeHead(200, { "Content-Type": "application/zip", "Content-Length": 3 }).end("zip");
    if (ruta === "/vacio.mkv") return res.writeHead(200, { "Content-Type": "video/x-matroska", "Content-Length": 0 }).end();
    if (ruta === "/caido.mkv") return res.writeHead(503).end();
    if (ruta === "/mudo.mkv") return res.writeHead(200, { "Content-Type": "video/x-matroska", "Content-Length": 1000 }).write("x");
    res.writeHead(404).end();
  });
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
});
afterAll(() => {
  servidor.closeAllConnections();
  servidor.close();
});
beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), "descargar-"));
  raiz = base;
  cortes = 0;
  pedidos = [];
  contenido = PELICULA;
  etiqueta = '"v1"';
});
afterEach(() => rm(base, { recursive: true, force: true }));

const enlace = (ruta) => `http://127.0.0.1:${servidor.address().port}${ruta}`;
const rapido = { espera: () => Promise.resolve() };

describe("descargar desde un enlace", () => {
  it("baja el archivo entero, con su avance, y la biblioteca lo ve como película lista", async () => {
    const avances = [];
    const r = await descargarALaBiblioteca(enlace("/pelis/Coco.2017.1080p.mkv"), raiz, { alAvance: (a) => avances.push(a), ...rapido });
    expect(r).toEqual({ video: "Coco.2017.1080p.mkv", yaEstaba: false, bytes: PELICULA.length });
    expect(await readdir(raiz)).toEqual(["Coco.2017.1080p.mkv"]);
    expect((await readFile(join(raiz, r.video))).equals(PELICULA)).toBe(true);
    expect(avances[0]).toEqual({ titulo: "Coco.2017.1080p", porcentaje: 0 });
    expect(avances.at(-2)).toEqual({ titulo: "Coco.2017.1080p", porcentaje: 100 });
    expect(avances.at(-1)).toBeNull();
    // No hay que esperar los dos minutos de «descarga a medias».
    const { peliculas, saltadas } = await leerBiblioteca(raiz);
    expect(peliculas.map((p) => p.titulo)).toEqual(["Coco"]);
    expect(saltadas).toEqual([]);
  });

  it("sigue las redirecciones y toma el nombre del archivo final", async () => {
    const r = await descargarALaBiblioteca(enlace("/ir"), raiz, rapido);
    expect(r.video).toBe("Coco.2017.1080p.mkv");
  });

  it("usa el nombre que dice el servidor (Content-Disposition), con sus acentos", async () => {
    const r = await descargarALaBiblioteca(enlace("/descargar?id=42"), raiz, rapido);
    expect(r.video).toBe("El niño y la garza.mkv");
  });

  it("un nombre con carpetas no escribe fuera de la biblioteca", async () => {
    const r = await descargarALaBiblioteca(enlace("/trampa"), raiz, rapido);
    expect(r.video).toBe("malo.mkv");
    expect(await readdir(raiz)).toEqual(["malo.mkv"]);
  });

  it("si responde una página web, lo dice claro y no deja nada", async () => {
    await expect(descargarALaBiblioteca(enlace("/pagina/Coco.mkv"), raiz, rapido)).rejects.toThrow(/abre una página web, no el vídeo/);
    expect(await readdir(raiz)).toEqual([]);
  });

  it("lo que no es un vídeo se rechaza diciendo qué es", async () => {
    await expect(descargarALaBiblioteca(enlace("/archivo.zip"), raiz, rapido)).rejects.toThrow(/«archivo\.zip», que no es un vídeo \(\.zip\)/);
    await expect(descargarALaBiblioteca(enlace("/vacio.mkv"), raiz, rapido)).rejects.toThrow(/archivo vacío/);
    expect(await readdir(raiz)).toEqual([]);
  });

  it("un enlace que ya no existe no se reintenta", async () => {
    await expect(descargarALaBiblioteca(enlace("/no-esta.mkv"), raiz, rapido)).rejects.toThrow(/ya no existe/);
    expect(pedidos).toHaveLength(1);
  });

  it("un servidor caído se reintenta y, si sigue caído, se dice", async () => {
    await expect(descargarALaBiblioteca(enlace("/caido.mkv"), raiz, { ...rapido, reintentos: 2 })).rejects.toThrow(/No pude conectar/);
    expect(pedidos).toHaveLength(3);
  });

  it("si se corta a la mitad, sigue por donde iba (Range) y el archivo queda idéntico", async () => {
    cortes = 2;
    const dichos = [];
    const r = await descargarALaBiblioteca(enlace("/pelis/Coco.2017.1080p.mkv"), raiz, { decir: (n, t) => dichos.push(t), ...rapido });
    expect(r.bytes).toBe(PELICULA.length);
    expect((await readFile(join(raiz, r.video))).equals(PELICULA)).toBe(true);
    expect(pedidos.map((p) => p.rango)).toEqual([null, "bytes=100000-", "bytes=166666-"]);
    expect(dichos.filter((t) => /Sigo por donde iba/.test(t))).toHaveLength(2);
    expect(await readdir(raiz)).toEqual(["Coco.2017.1080p.mkv"]);
  });

  it("si el servidor no sabe de rangos, tras el corte empieza de cero y no duplica trozos", async () => {
    cortes = 1;
    const r = await descargarALaBiblioteca(enlace("/sin-rangos/Coco.mkv"), raiz, rapido);
    expect((await readFile(join(raiz, r.video))).equals(PELICULA)).toBe(true);
  });

  it("si no llega a terminar, deja el .part (la sincronización no lo sube) y con el mismo enlace sigue otro día", async () => {
    cortes = 99;
    await expect(descargarALaBiblioteca(enlace("/pelis/Coco.2017.1080p.mkv"), raiz, { ...rapido, reintentos: 1 })).rejects.toThrow(/pega el mismo enlace otra vez/);
    expect((await readdir(raiz)).sort()).toEqual(["Coco.2017.1080p.mkv.part", "Coco.2017.1080p.mkv.part.info"]);
    const bajado = (await stat(join(raiz, "Coco.2017.1080p.mkv.part"))).size;
    expect(bajado).toBeGreaterThan(0);
    const { peliculas, saltadas } = await leerBiblioteca(raiz);
    expect(peliculas).toEqual([]);
    expect(saltadas.length).toBe(1);

    cortes = 0;
    pedidos = [];
    const r = await descargarALaBiblioteca(enlace("/pelis/Coco.2017.1080p.mkv"), raiz, rapido);
    expect(pedidos.map((p) => p.rango)).toEqual([null, `bytes=${bajado}-`]);
    expect((await readFile(join(raiz, r.video))).equals(PELICULA)).toBe(true);
    expect(await readdir(raiz)).toEqual(["Coco.2017.1080p.mkv"]);
  });

  it("un .part de OTRO archivo (cambió en el servidor) no se aprovecha", async () => {
    cortes = 99;
    await expect(descargarALaBiblioteca(enlace("/pelis/Coco.2017.1080p.mkv"), raiz, { ...rapido, reintentos: 0 })).rejects.toThrow();
    cortes = 0;
    etiqueta = '"v2"';
    contenido = Buffer.from(PELICULA).reverse();
    pedidos = [];
    const r = await descargarALaBiblioteca(enlace("/pelis/Coco.2017.1080p.mkv"), raiz, rapido);
    expect(pedidos.map((p) => p.rango)).toEqual([null]);
    expect((await readFile(join(raiz, r.video))).equals(contenido)).toBe(true);
  });

  it("nunca sobrescribe: el mismo archivo «ya estaba», otro con ese nombre va como (2)", async () => {
    await descargarALaBiblioteca(enlace("/pelis/Coco.2017.1080p.mkv"), raiz, rapido);
    const otraVez = await descargarALaBiblioteca(enlace("/pelis/Coco.2017.1080p.mkv"), raiz, rapido);
    expect(otraVez).toEqual({ video: "Coco.2017.1080p.mkv", yaEstaba: true, bytes: 0 });

    await writeFile(join(raiz, "Coco.2017.1080p.mkv"), "otra película con el mismo nombre");
    const distinta = await descargarALaBiblioteca(enlace("/pelis/Coco.2017.1080p.mkv"), raiz, rapido);
    expect(distinta.video).toBe("Coco.2017.1080p (2).mkv");
    expect(await readFile(join(raiz, "Coco.2017.1080p.mkv"), "utf8")).toBe("otra película con el mismo nombre");
  });

  it("sin sitio en el disco no empieza", async () => {
    contenido = Buffer.alloc(1);
    // Un servidor que anuncia un archivo imposible de guardar.
    const gordo = (u, o) => fetch(u, o).then((r) => new Response(r.body, { status: 200, headers: { "content-type": "video/x-matroska", "content-length": String(2 ** 60) } }));
    await expect(descargarALaBiblioteca(enlace("/pelis/Coco.2017.1080p.mkv"), raiz, { ...rapido, pedir: gordo })).rejects.toThrow(/No hay sitio en el disco para bajarla/);
    expect(await readdir(raiz)).toEqual([]);
  });

  it("cancelar corta y borra lo bajado", async () => {
    const control = new AbortController();
    const promesa = descargarALaBiblioteca(enlace("/mudo.mkv"), raiz, { ...rapido, senal: control.signal, alAvance: (a) => a && control.abort() });
    await expect(promesa).rejects.toThrow("Descarga cancelada.");
    expect(await readdir(raiz)).toEqual([]);
  });

  it("un servidor que se queda mudo no cuelga el panel para siempre", async () => {
    await expect(descargarALaBiblioteca(enlace("/mudo.mkv"), raiz, { ...rapido, reintentos: 0, sinDatosMs: 150 })).rejects.toThrow(/dejó de mandar datos/);
  });
});

describe("el enlace y el nombre", () => {
  it("solo enlaces http(s) directos", () => {
    expect(leerEnlace("  https://ejemplo.com/a.mkv ").href).toBe("https://ejemplo.com/a.mkv");
    expect(() => leerEnlace("")).toThrow(/Pega el enlace/);
    expect(() => leerEnlace("magnet:?xt=urn:btih:abc")).toThrow(/magnet/);
    expect(() => leerEnlace("C:\\Pelis\\a.mkv")).toThrow(/http/);
    expect(() => leerEnlace("file:///etc/passwd")).toThrow(/http/);
    expect(() => leerEnlace("ftp://ejemplo.com/a.mkv")).toThrow(/http/);
    expect(() => leerEnlace("https://yo:clave@ejemplo.com/a.mkv")).toThrow(/usuario y contraseña/);
  });

  it("lee el nombre de Content-Disposition en sus dos formas", () => {
    expect(nombreDeCabecera('attachment; filename="Coco (2017).mkv"')).toBe("Coco (2017).mkv");
    expect(nombreDeCabecera("attachment; filename=Coco.mkv")).toBe("Coco.mkv");
    expect(nombreDeCabecera("attachment; filename=\"x.mkv\"; filename*=UTF-8''Canci%C3%B3n.mkv")).toBe("Canción.mkv");
    expect(nombreDeCabecera(null)).toBe("");
  });

  it("deja un nombre que Windows acepta", () => {
    expect(nombreSeguro('Coco: la "peli"?.mkv')).toBe("Coco la peli .mkv");
    expect(nombreSeguro("../../etc/passwd.mkv")).toBe("passwd.mkv");
    expect(nombreSeguro("CON.mkv")).toBe("_CON.mkv");
    expect(nombreSeguro("...")).toBe("");
  });

  it("sin extensión, el tipo del servidor decide; sin ninguna pista, no vale", () => {
    expect(nombreDeDescarga({ disposicion: null, urlFinal: "https://x.test/d/abc123", tipo: "video/mp4" })).toBe("abc123.mp4");
    expect(nombreDeDescarga({ disposicion: null, urlFinal: "https://x.test/Mi%20peli.MP4?t=1", tipo: "application/octet-stream" })).toBe("Mi peli.MP4");
    expect(() => nombreDeDescarga({ disposicion: null, urlFinal: "https://x.test/d/abc123", tipo: "application/octet-stream" })).toThrow(/no dice que sea un vídeo/);
  });
});
