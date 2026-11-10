#!/usr/bin/env node
/**
 * El servidor de las pruebas de navegador (`npm run e2e`).
 *
 * Hace tres cosas, y por eso no basta con `next start`:
 *
 *  1. Sirve los datos de mentira: una lista M3U de tres canales (para que el
 *     servidor de Next no salga a internet) y un «bucket de R2» con un
 *     catálogo y una película de 170 KB (para el navegador, con CORS y `Range`
 *     como el de verdad).
 *  2. Compila la app con las variables de prueba. Las `NEXT_PUBLIC_*` se
 *     graban al compilar, así que la clave de Pusher falsa y la URL del bucket
 *     tienen que estar puestas ANTES del build.
 *  3. Arranca `next start`.
 *
 * Ojo: deja en `.next` una compilación con claves de mentira. No pasa nada
 * —Vercel compila la suya—, pero no arranques `npm start` a mano después sin
 * volver a compilar.
 */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CLAVE_PUSHER, PUERTO_APP, PUERTO_DATOS, SECRETO_PUSHER, URL_DATOS } from "./constantes.mjs";


const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, "..");
const VIDEO = join(aqui, "fixtures", "pelicula.webm");

const CATALOGO = {
  version: 2,
  peliculas: [
    {
      id: "coco",
      titulo: "Coco",
      url: `${URL_DATOS}/peliculas/coco/pelicula.webm`,
      duracion: 120,
      // Con subtítulos, como una película de verdad: es lo que llena la barra
      // del reproductor en el teléfono.
      subtitulos: [
        { label: "Español", srclang: "es", url: `${URL_DATOS}/peliculas/coco/es.vtt` },
        { label: "Inglés", srclang: "en", url: `${URL_DATOS}/peliculas/coco/en.vtt` },
      ],
    },
    { id: "matrix", titulo: "Matrix", url: `${URL_DATOS}/peliculas/matrix/pelicula.webm`, duracion: 120, subtitulos: [] },
  ],
};

function servirVideo(peticion, respuesta) {
  const total = statSync(VIDEO).size;
  const rango = /^bytes=(\d+)-(\d*)$/.exec(peticion.headers.range ?? "");
  const cabeceras = { "Content-Type": "video/webm", "Accept-Ranges": "bytes" };
  if (!rango) {
    respuesta.writeHead(200, { ...cabeceras, "Content-Length": total });
    createReadStream(VIDEO).pipe(respuesta);
    return;
  }
  const desde = Number(rango[1]);
  const hasta = rango[2] ? Math.min(Number(rango[2]), total - 1) : total - 1;
  respuesta.writeHead(206, {
    ...cabeceras,
    "Content-Range": `bytes ${desde}-${hasta}/${total}`,
    "Content-Length": hasta - desde + 1,
  });
  createReadStream(VIDEO, { start: desde, end: hasta }).pipe(respuesta);
}

const datos = createServer((peticion, respuesta) => {
  // El mismo CORS que se le pide al bucket de verdad (docs/PELICULAS-JUNTOS.md).
  respuesta.setHeader("Access-Control-Allow-Origin", "*");
  respuesta.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");
  const ruta = new URL(peticion.url ?? "/", URL_DATOS).pathname;
  if (ruta === "/lista.m3u") {
    respuesta.writeHead(200, { "Content-Type": "audio/x-mpegurl" });
    respuesta.end(readFileSync(join(aqui, "fixtures", "lista.m3u")));
  } else if (ruta === "/peliculas/catalogo.json") {
    respuesta.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
    respuesta.end(JSON.stringify(CATALOGO));
  } else if (ruta.endsWith(".vtt")) {
    respuesta.writeHead(200, { "Content-Type": "text/vtt; charset=utf-8" });
    respuesta.end("WEBVTT\n\n00:00:01.000 --> 00:01:59.000\nTodos deben calmarse.\n");
  } else if (ruta.endsWith("/pelicula.webm")) {
    servirVideo(peticion, respuesta);
  } else if (ruta.startsWith("/tmdb/")) {
    // Un TMDB de mentira: lo justo para que exista la ficha de una película.
    const ficha = /^\/tmdb\/movie\/(\d+)$/.exec(ruta);
    respuesta.writeHead(200, { "Content-Type": "application/json" });
    respuesta.end(
      JSON.stringify(
        ficha
          ? { id: Number(ficha[1]), title: "Película de prueba", overview: "Una sinopsis.", release_date: "2020-01-01", runtime: 100, genres: [], vote_average: 7 }
          : { page: 1, total_pages: 1, results: [] },
      ),
    );
  } else {
    respuesta.writeHead(404).end();
  }
});

{
  const entorno = {
    ...process.env,
    M3U_URL: `${URL_DATOS}/lista.m3u`,
    EPG_URL: "",
    TMDB_API_KEY: "clave-de-prueba",
    TMDB_API_BASE: `${URL_DATOS}/tmdb`,
    VIMEUS_API_KEY: "",
    NEXT_PUBLIC_PELICULAS_URL: URL_DATOS,
    NEXT_PUBLIC_PUSHER_KEY: CLAVE_PUSHER,
    NEXT_PUBLIC_PUSHER_CLUSTER: "mt1",
    PUSHER_SECRET: SECRETO_PUSHER,
    NEXT_TELEMETRY_DISABLED: "1",
  };
  datos.listen(PUERTO_DATOS, "127.0.0.1", () => {
    const next = join(raiz, "node_modules", "next", "dist", "bin", "next");
    if (!process.env.E2E_SIN_COMPILAR) {
      const build = spawnSync(process.execPath, [next, "build"], { cwd: raiz, env: entorno, stdio: "inherit" });
      if (build.status !== 0) process.exit(build.status ?? 1);
    }
    const app = spawn(process.execPath, [next, "start", "-p", String(PUERTO_APP)], { cwd: raiz, env: entorno, stdio: "inherit" });
    const cerrar = () => {
      app.kill();
      datos.close();
      process.exit(0);
    };
    process.on("SIGTERM", cerrar);
    process.on("SIGINT", cerrar);
    app.on("exit", (codigo) => process.exit(codigo ?? 0));
  });
}
