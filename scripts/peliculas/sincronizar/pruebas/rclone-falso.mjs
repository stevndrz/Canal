#!/usr/bin/env node
/**
 * Un rclone de mentira para probar el programa ENTERO (`sincronizar.mjs`),
 * no solo su lógica: la «nube» es la carpeta de `RCLONE_FALSO_NUBE`, y cada
 * llamada se apunta en `RCLONE_FALSO_REGISTRO` para poder comprobar qué se le
 * pidió exactamente — sobre todo, que en automático nunca se le pida borrar.
 *
 * Entiende solo las órdenes que usa `lib/nube.mjs`.
 */
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const [orden, ...resto] = process.argv.slice(2);
const nube = process.env.RCLONE_FALSO_NUBE;
if (process.env.RCLONE_FALSO_REGISTRO) appendFileSync(process.env.RCLONE_FALSO_REGISTRO, `${orden} ${resto.join(" ")}\n`);

/** «r2:cubo/peliculas/x» → la ruta en la carpeta; una ruta local se queda igual. */
const ruta = (r) => (/^[a-z0-9]+:/i.test(r) && !/^[a-z]:[\\/]/i.test(r) ? join(nube, r.replace(/^[^:]+:[^/]*\/?/, "")) : r);
const posicionales = [];
const opciones = {};
for (let i = 0; i < resto.length; i++) {
  if (!resto[i].startsWith("--")) posicionales.push(resto[i]);
  else if (["--include", "--header-upload", "--transfers", "--retries", "--low-level-retries"].includes(resto[i])) opciones[resto[i]] = resto[++i];
  else opciones[resto[i]] = true;
}
const [a, b] = posicionales.map(ruta);
const fallar = (texto) => {
  process.stderr.write(`${texto}\n`);
  process.exit(1);
};
const archivosDe = (carpeta, base = carpeta) =>
  readdirSync(carpeta, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? archivosDe(join(carpeta, e.name), base) : [join(carpeta, e.name).slice(base.length + 1)],
  );

switch (orden) {
  case "--version":
  case "version":
    console.log("rclone v0.0.0-falso");
    break;
  case "config":
    // «config file»: sin archivo de configuración, luego sin contraseña.
    console.log("Configuration file doesn't exist, but rclone will use this path:\n/no/existe/rclone.conf");
    break;
  case "lsf": {
    if (!existsSync(a)) break;
    for (const e of readdirSync(a, { withFileTypes: true })) {
      if (opciones["--dirs-only"] && e.isDirectory()) console.log(`${e.name}/`);
      if (opciones["--files-only"] && e.isFile()) console.log(e.name);
    }
    break;
  }
  case "cat":
    if (!existsSync(a)) fallar("object not found");
    process.stdout.write(readFileSync(a));
    break;
  case "copyto":
    if (!existsSync(a)) fallar("object not found");
    mkdirSync(dirname(b), { recursive: true });
    cpSync(a, b);
    break;
  case "copy": {
    const patron = new RegExp(`^${String(opciones["--include"] ?? "*").replace(/\./g, "\\.").replace(/\*/g, ".*")}$`);
    for (const relativo of archivosDe(a)) {
      if (!patron.test(relativo.split(/[\\/]/).pop())) continue;
      mkdirSync(dirname(join(b, relativo)), { recursive: true });
      cpSync(join(a, relativo), join(b, relativo));
    }
    break;
  }
  case "check":
    for (const relativo of archivosDe(a)) {
      if (!existsSync(join(b, relativo)) || statSync(join(b, relativo)).size !== statSync(join(a, relativo)).size) fallar(`falta ${relativo}`);
    }
    break;
  case "purge":
    rmSync(a, { recursive: true, force: true });
    break;
  case "deletefile":
    if (!existsSync(a)) fallar("object not found");
    rmSync(a);
    break;
  case "size": {
    const bytes = existsSync(a) ? archivosDe(a).reduce((t, r) => t + statSync(join(a, r)).size, 0) : 0;
    console.log(JSON.stringify({ count: 0, bytes: Number(process.env.RCLONE_FALSO_BYTES ?? bytes) }));
    break;
  }
  default:
    fallar(`rclone falso: no conozco «${orden}»`);
}
