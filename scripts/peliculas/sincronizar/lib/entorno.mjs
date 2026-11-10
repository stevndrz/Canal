/**
 * Lo que comparten la consola (`sincronizar.mjs`) y el panel (`panel.mjs`):
 * dónde están las cosas en el PC, cómo lanzar programas, la configuración de
 * R2 y el candado de «una sola sincronización a la vez».
 */

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

// ── Dónde están las cosas ───────────────────────────────────────────────────
export const carpetaLocal = () => join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "CanalCasa");
export const carpetaConfig = () => join(process.env.APPDATA ?? join(homedir(), ".config"), "CanalCasa");
export const rutaConfig = () => join(carpetaConfig(), "peliculas.json");
export const carpetaPorDefecto = () => join(homedir(), "Downloads", "Peliculas");
export const carpetaTrabajo = () => {
  const t = join(tmpdir(), "canalcasa");
  mkdirSync(t, { recursive: true });
  return t;
};

/** El registro del día en %LOCALAPPDATA%\CanalCasa\registro\. */
export function crearRegistro(cabecera) {
  mkdirSync(join(carpetaLocal(), "registro"), { recursive: true });
  const ruta = join(carpetaLocal(), "registro", `${new Date().toISOString().slice(0, 10)}.txt`);
  const registrar = (texto) => {
    try {
      appendFileSync(ruta, `${new Date().toISOString()} ${texto}\n`);
    } catch {
      // Sin registro se sigue: no es motivo para cortar una subida.
    }
  };
  if (cabecera) registrar(cabecera);
  return { ruta, registrar };
}

// ── Lanzar programas, sin shell ─────────────────────────────────────────────
/**
 * Sin shell a propósito: el nombre de una película va como argumento suelto,
 * así que un archivo llamado «x & del *.*» no puede ejecutar nada.
 * Con `mostrar`, la salida se pasa en vivo a `alSalida` (el avance de ffmpeg
 * y rclone) y, de paso, se guarda para poder explicar un fallo.
 */
export function crearEjecutar(registrar, entorno = process.env, alSalida = (d, flujo) => flujo.write(d)) {
  return (programa, args, { cwd, mostrar = false } = {}) =>
    new Promise((resolver) => {
      // stdin cerrado: si un programa se pusiera a preguntar algo, falla en
      // vez de quedarse esperando para siempre detrás de la ventana.
      const hijo = spawn(programa, args, { cwd, windowsHide: true, env: entorno, stdio: ["ignore", "pipe", "pipe"] });
      let salida = "";
      let error = "";
      hijo.stdout.on("data", (d) => {
        salida += d;
        if (mostrar) alSalida(d, process.stdout);
      });
      hijo.stderr.on("data", (d) => {
        error += d;
        if (mostrar) alSalida(d, process.stderr);
        if (error.length > 200_000) error = error.slice(-100_000);
      });
      hijo.on("error", (e) => resolver({ codigo: -1, salida, error: String(e) }));
      hijo.on("close", (codigo) => {
        if (codigo !== 0) registrar(`[${programa} salió con ${codigo}] ${error.slice(-2000)}`);
        resolver({ codigo, salida, error });
      });
    });
}

export function hay(programa) {
  return spawnSync(programa, ["--version"], { stdio: "ignore", windowsHide: true }).status === 0 ||
    spawnSync(programa, ["-version"], { stdio: "ignore", windowsHide: true }).status === 0;
}

/** ffmpeg, ffprobe y rclone: el primero que falte, con cómo instalarlo. */
export function faltaPrograma() {
  for (const h of ["ffmpeg", "ffprobe", "rclone"]) {
    if (!hay(h)) return `No encuentro «${h}». Ejecuta preparar-pc.ps1, o: winget install ${h === "rclone" ? "Rclone.Rclone" : "Gyan.FFmpeg"}`;
  }
  return null;
}

/** Qué sabe hacer el ffmpeg de este PC (aceleración por GPU, HDR). */
export function capacidadesDeFfmpeg() {
  const probarCodificador = (nombre) =>
    spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=size=256x256", "-frames:v", "1", "-c:v", nombre, "-f", "null", "-"], { windowsHide: true }).status === 0;
  const hayZscale = /zscale/.test(spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8", windowsHide: true }).stdout ?? "");
  return { probarCodificador, hayZscale };
}

// ── Configuración de R2 (la misma de los scripts de PowerShell) ─────────────
/** La configuración guardada, o null si es la primera vez. */
export function leerConfigGuardada(ruta = rutaConfig()) {
  if (!existsSync(ruta)) return null;
  const c = JSON.parse(readFileSync(ruta, "utf8").replace(/^﻿/, ""));
  return {
    remoto: c.Remoto ?? c.remoto,
    cubo: c.Cubo ?? c.cubo,
    urlPublica: c.UrlPublica ?? c.urlPublica,
    carpeta: c.Carpeta ?? c.carpeta ?? null,
  };
}

/** Comprueba y guarda (con los nombres de siempre, para los scripts de PowerShell). */
export function guardarConfig({ remoto, cubo, urlPublica, carpeta }, ruta = rutaConfig()) {
  const limpia = {
    remoto: String(remoto ?? "").trim() || "r2",
    cubo: String(cubo ?? "").trim() || "canalcasa-peliculas",
    urlPublica: String(urlPublica ?? "").trim().replace(/\/+$/, ""),
    carpeta: carpeta ? String(carpeta) : null,
  };
  if (!/^https:\/\//.test(limpia.urlPublica)) throw new Error("La URL pública tiene que empezar por https://");
  if (!/^[\w.-]+$/.test(limpia.remoto) || !/^[\w.-]+$/.test(limpia.cubo)) throw new Error("El remoto y el bucket solo llevan letras, números, puntos y guiones.");
  mkdirSync(join(ruta, ".."), { recursive: true });
  const datos = { Remoto: limpia.remoto, Cubo: limpia.cubo, UrlPublica: limpia.urlPublica };
  if (limpia.carpeta) datos.Carpeta = limpia.carpeta;
  writeFileSync(ruta, JSON.stringify(datos, null, 2), "utf8");
  return limpia;
}

/** La primera vez se pregunta (en la consola) y se guarda. */
export async function leerConfig(preguntarTexto) {
  const guardada = leerConfigGuardada();
  if (guardada) return guardada;
  console.log("\nPrimera vez: dónde se suben las películas (ver docs/PELICULAS-JUNTOS.md).");
  const remoto = (await preguntarTexto("Nombre del remoto de rclone [r2]: ")) || "r2";
  const cubo = (await preguntarTexto("Nombre del bucket de R2 [canalcasa-peliculas]: ")) || "canalcasa-peliculas";
  const urlPublica = await preguntarTexto("URL pública del bucket (https://pub-….r2.dev): ");
  return guardarConfig({ remoto, cubo, urlPublica });
}

// ── Configuración de rclone cifrada ──────────────────────────────────────────
/**
 * Si la configuración de rclone tiene contraseña (`rclone config` → `s`, lo
 * recomendado para que la llave de R2 no esté en claro en el disco), rclone
 * la pediría por su cuenta en cada llamada. Se pide una vez y se le pasa por
 * `RCLONE_CONFIG_PASS`, solo a rclone.
 */
export function rcloneCifrado() {
  if (process.env.RCLONE_CONFIG_PASS) return false;
  const ruta = (spawnSync("rclone", ["config", "file"], { encoding: "utf8", windowsHide: true }).stdout ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /rclone\.conf$/i.test(l));
  return Boolean(ruta && existsSync(ruta) && /RCLONE_ENCRYPT_V0/.test(readFileSync(ruta, "utf8")));
}

// ── Un solo proceso a la vez ─────────────────────────────────────────────────
export function tomarCandado(ruta = join(carpetaLocal(), "sincronizar.lock")) {
  mkdirSync(join(ruta, ".."), { recursive: true });
  if (existsSync(ruta)) {
    const pid = Number(readFileSync(ruta, "utf8"));
    if (pid !== process.pid && vivo(pid)) throw new Error(`Ya hay una sincronización en marcha (proceso ${pid}). Espera a que termine.`);
  }
  writeFileSync(ruta, String(process.pid));
  return () => rmSync(ruta, { force: true });
}

export function vivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
