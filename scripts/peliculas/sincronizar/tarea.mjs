#!/usr/bin/env node
/**
 * Sincronizar sola: activa, quita o consulta la tarea de Windows que lanza la
 * sincronización cada diez minutos, sin ventana.
 *
 *   node tarea.mjs activar | quitar | estado
 *   (o doble clic en «Sincronizar sola.cmd», que pregunta)
 *
 * La tarea ejecuta `sincronizar.mjs --automatico`: sube lo nuevo y actualiza
 * títulos y subtítulos, pero NUNCA borra nada de la nube. Lo que haya que
 * decidir queda en «Estado de la sincronizacion.txt», en la carpeta.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { ARCHIVO_ESTADO, CADA_MINUTOS, NOMBRE_TAREA, argumentosConsultar, argumentosCrear, argumentosQuitar, guionOculto } from "./lib/automatico.mjs";

const aqui = dirname(fileURLToPath(import.meta.url));
const local = join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "CanalCasa");
const rutaVbs = join(local, "sincronizar-oculto.vbs");
const rutaConfig = join(process.env.APPDATA ?? join(homedir(), ".config"), "CanalCasa", "peliculas.json");

const schtasks = (args) => spawnSync("schtasks", args, { encoding: "utf8", windowsHide: true });
const activa = () => schtasks(argumentosConsultar()).status === 0;

function activar() {
  if (!existsSync(rutaConfig)) {
    throw new Error("Antes abre una vez «Sincronizar peliculas.cmd» a mano: pregunta dónde se suben las películas y lo recuerda.");
  }
  mkdirSync(local, { recursive: true });
  // UTF-16 con BOM: es como `wscript` lee bien una ruta con acentos («José»).
  writeFileSync(rutaVbs, Buffer.from(`﻿${guionOculto(process.execPath, join(aqui, "sincronizar.mjs"))}`, "utf16le"));
  const r = schtasks(argumentosCrear(rutaVbs));
  if (r.status !== 0) throw new Error(`Windows no dejó crear la tarea: ${(r.stderr || r.stdout || "").trim()}`);
  console.log(`\n   ✔ Activada: cada ${CADA_MINUTOS} minutos, sin ventana, mientras tengas la sesión abierta.`);
  console.log("     · Sube lo nuevo que dejes en Descargas\\Peliculas (espera a que la descarga lleve 2 minutos quieta).");
  console.log("     · Nunca borra nada de la nube: eso se decide con «Sincronizar peliculas.cmd».");
  console.log(`     · Lo que hizo la última vez: «${ARCHIVO_ESTADO}», en esa misma carpeta.`);
}

function quitar() {
  const r = schtasks(argumentosQuitar());
  rmSync(rutaVbs, { force: true });
  if (r.status !== 0 && activa()) throw new Error(`Windows no dejó quitar la tarea: ${(r.stderr || r.stdout || "").trim()}`);
  console.log("\n   ✔ Quitada. Las películas ya subidas siguen en la nube; ahora solo se sincroniza a mano.");
}

async function principal() {
  if (process.platform !== "win32") throw new Error("La tarea programada es de Windows. En otro sistema, usa cron con: node sincronizar.mjs --automatico");
  let orden = process.argv[2];
  const estaba = activa();
  if (!orden) {
    console.log(`\nSincronizar sola (${NOMBRE_TAREA}): ${estaba ? "ACTIVADA" : "desactivada"}.`);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const r = (await rl.question(estaba ? "   ¿La quito? [s/N] " : "   ¿La activo? [S/n] ")).trim().toLowerCase();
    rl.close();
    if (estaba) orden = r.startsWith("s") ? "quitar" : "estado";
    else orden = r === "" || r.startsWith("s") ? "activar" : "estado";
  }
  if (orden === "activar") activar();
  else if (orden === "quitar") quitar();
  else if (orden === "estado") console.log(`\n   Sincronizar sola: ${activa() ? "activada" : "desactivada"}.`);
  else throw new Error(`No conozco «${orden}». Usa: activar, quitar o estado.`);
}

try {
  await principal();
} catch (error) {
  console.error(`\n   ✖ ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
