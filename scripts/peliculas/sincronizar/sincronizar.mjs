#!/usr/bin/env node
/**
 * Sincronizar «Nuestras películas»: la carpeta del PC → Cloudflare R2.
 *
 *   Doble clic en «Sincronizar peliculas.cmd» (en Descargas\Peliculas).
 *
 * Lo que haya en Descargas\Peliculas —con el nombre que traiga, y sus .srt al
 * lado o en su carpeta— queda en la nube y en la app:
 *
 *   - una película nueva se convierte y se sube;
 *   - un .srt nuevo, cambiado o borrado: solo se suben o quitan los subtítulos;
 *   - renombrar el archivo o su carpeta cambia el título en la app;
 *   - una película que ya no está en la carpeta: PREGUNTA si borrarla de la nube.
 *
 * Opciones (también se pueden arrastrar al .cmd):
 *   --mirar               enseña el plan y no hace nada
 *   --carpeta "C:\…"      otra carpeta en vez de Descargas\Peliculas
 *   --calidad 26          al recodificar: más alto = más pequeño (16–32, 24 por defecto)
 *   --aceleracion cpu     auto (por defecto) · nvidia · intel · amd · cpu
 *   --audio eng           el audio que suena primero (por defecto spa)
 *   --subtitulos todos    idiomas de los subtítulos de DENTRO del vídeo (por defecto spa,eng)
 *   --recodificar         recodifica aunque se pudiera copiar
 *
 * Necesita Node 20+, ffmpeg y rclone (los instala `preparar-pc.ps1`). La
 * configuración de R2 es la misma de los scripts de antes
 * (%APPDATA%\CanalCasa\peliculas.json); si no está, se pregunta una vez.
 */

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { crearNubeRclone } from "./lib/nube.mjs";
import { sincronizar } from "./lib/sincronizar.mjs";

const COLORES = { titulo: "\x1b[36m", bien: "\x1b[32m", aviso: "\x1b[33m", error: "\x1b[31m", info: "" };
const FIN = "\x1b[0m";

// ── Opciones ────────────────────────────────────────────────────────────────
function leerOpciones(argv) {
  const op = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const valor = () => argv[++i];
    if (a === "--mirar") op.mirar = true;
    else if (a === "--recodificar") op.recodificar = true;
    else if (a === "--carpeta") op.carpeta = valor();
    else if (a === "--calidad") op.calidad = Math.min(32, Math.max(16, Number(valor()) || 24));
    else if (a === "--aceleracion") op.aceleracion = valor();
    else if (a === "--audio") op.audio = valor();
    else if (a === "--subtitulos") op.idiomasSubs = String(valor()).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--sin-pausa") op.sinPausa = true;
    else throw new Error(`No conozco la opción «${a}». Mira el principio de sincronizar.mjs.`);
  }
  return op;
}

// ── Lanzar programas, sin shell ─────────────────────────────────────────────
/**
 * Sin shell a propósito: el nombre de una película va como argumento suelto,
 * así que un archivo llamado «x & del *.*» no puede ejecutar nada.
 * Con `mostrar`, la salida se ve en vivo (el avance de ffmpeg y rclone) y,
 * de paso, se guarda para poder explicar un fallo.
 */
function crearEjecutar(registrar, entorno = process.env) {
  return (programa, args, { cwd, mostrar = false } = {}) =>
    new Promise((resolver) => {
      // stdin cerrado: si un programa se pusiera a preguntar algo, falla en
      // vez de quedarse esperando para siempre detrás de la ventana.
      const hijo = spawn(programa, args, { cwd, windowsHide: true, env: entorno, stdio: ["ignore", "pipe", "pipe"] });
      let salida = "";
      let error = "";
      hijo.stdout.on("data", (d) => {
        salida += d;
        if (mostrar) process.stdout.write(d);
      });
      hijo.stderr.on("data", (d) => {
        error += d;
        if (mostrar) process.stderr.write(d);
        if (error.length > 200_000) error = error.slice(-100_000);
      });
      hijo.on("error", (e) => resolver({ codigo: -1, salida, error: String(e) }));
      hijo.on("close", (codigo) => {
        if (codigo !== 0) registrar(`[${programa} salió con ${codigo}] ${error.slice(-2000)}`);
        resolver({ codigo, salida, error });
      });
    });
}

function hay(programa) {
  return spawnSync(programa, ["--version"], { stdio: "ignore", windowsHide: true }).status === 0 ||
    spawnSync(programa, ["-version"], { stdio: "ignore", windowsHide: true }).status === 0;
}

// ── Configuración de R2 (la misma de los scripts de PowerShell) ─────────────
async function leerConfig(preguntarTexto) {
  const carpeta = join(process.env.APPDATA ?? join(homedir(), ".config"), "CanalCasa");
  const ruta = join(carpeta, "peliculas.json");
  if (existsSync(ruta)) {
    const c = JSON.parse(readFileSync(ruta, "utf8").replace(/^\uFEFF/, ""));
    return { remoto: c.Remoto ?? c.remoto, cubo: c.Cubo ?? c.cubo, urlPublica: c.UrlPublica ?? c.urlPublica };
  }
  console.log("\nPrimera vez: dónde se suben las películas (ver docs/PELICULAS-JUNTOS.md).");
  const remoto = (await preguntarTexto("Nombre del remoto de rclone [r2]: ")) || "r2";
  const cubo = (await preguntarTexto("Nombre del bucket de R2 [canalcasa-peliculas]: ")) || "canalcasa-peliculas";
  const urlPublica = (await preguntarTexto("URL pública del bucket (https://pub-….r2.dev): ")).replace(/\/+$/, "");
  if (!/^https:\/\//.test(urlPublica)) throw new Error("La URL pública tiene que empezar por https://");
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(ruta, JSON.stringify({ Remoto: remoto, Cubo: cubo, UrlPublica: urlPublica }, null, 2), "utf8");
  return { remoto, cubo, urlPublica };
}

// ── Configuración de rclone cifrada ──────────────────────────────────────────
/**
 * Si la configuración de rclone tiene contraseña (`rclone config` → `s`, lo
 * recomendado para que la llave de R2 no esté en claro en el disco), rclone
 * la pediría por su cuenta en cada llamada. Se pide aquí una vez, sin que se
 * vea al escribir, y se le pasa por `RCLONE_CONFIG_PASS`, solo a rclone.
 */
async function contrasenaDeRclone(rl) {
  if (process.env.RCLONE_CONFIG_PASS) return process.env.RCLONE_CONFIG_PASS;
  const ruta = (spawnSync("rclone", ["config", "file"], { encoding: "utf8", windowsHide: true }).stdout ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => /rclone\.conf$/i.test(l));
  if (!ruta || !existsSync(ruta) || !/RCLONE_ENCRYPT_V0/.test(readFileSync(ruta, "utf8"))) return null;
  const escribir = rl._writeToOutput;
  rl._writeToOutput = (texto) => {
    if (texto.includes("Contraseña")) escribir.call(rl, texto);
  };
  try {
    return (await rl.question("   Contraseña de la configuración de rclone: ")).trim();
  } finally {
    rl._writeToOutput = escribir;
    process.stdout.write("\n");
  }
}

// ── Un solo proceso a la vez ─────────────────────────────────────────────────
function tomarCandado(ruta) {
  if (existsSync(ruta)) {
    const pid = Number(readFileSync(ruta, "utf8"));
    let vivo = false;
    try {
      process.kill(pid, 0);
      vivo = true;
    } catch {
      vivo = false;
    }
    if (vivo) throw new Error(`Ya hay una sincronización en marcha (proceso ${pid}). Espera a que termine.`);
  }
  writeFileSync(ruta, String(process.pid));
  return () => rmSync(ruta, { force: true });
}

// ── Principal ───────────────────────────────────────────────────────────────
async function principal() {
  let op = {};
  let errorDeOpciones = null;
  try {
    op = leerOpciones(process.argv.slice(2));
  } catch (error) {
    errorDeOpciones = error;
  }
  const local = join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "CanalCasa");
  mkdirSync(join(local, "registro"), { recursive: true });
  const rutaRegistro = join(local, "registro", `${new Date().toISOString().slice(0, 10)}.txt`);
  const registrar = (texto) => appendFileSync(rutaRegistro, `${new Date().toISOString()} ${texto}\n`);
  registrar(`── sincronizar ${process.argv.slice(2).join(" ")}`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Sin nadie al teclado (la entrada se cerró): vale lo que diga cada
  // pregunta por defecto. Para borrar, el defecto es siempre «no».
  let cerrada = false;
  rl.on("close", () => (cerrada = true));
  const leerLinea = async (texto) => {
    if (cerrada) return "";
    try {
      return await rl.question(texto);
    } catch {
      return "";
    }
  };
  const preguntarTexto = async (texto) => (await leerLinea(texto)).trim();
  const preguntar = async (texto, porDefecto) => {
    const r = (await leerLinea(`   ${texto} ${porDefecto ? "[S/n]" : "[s/N]"} `)).trim().toLowerCase();
    const si = r === "" ? porDefecto : r.startsWith("s");
    registrar(`? ${texto} → ${si ? "sí" : "no"}`);
    return si;
  };
  const decir = (tipo, texto) => {
    const marca = tipo === "titulo" ? "\n── " : tipo === "bien" ? "   ✔ " : tipo === "aviso" ? "   ⚠ " : tipo === "error" ? "   ✖ " : "   ";
    console.log(`${COLORES[tipo] ?? ""}${marca}${texto}${FIN}`);
    registrar(`${tipo}: ${texto}`);
  };

  let soltar = () => {};
  try {
    if (errorDeOpciones) throw errorDeOpciones;
    for (const h of ["ffmpeg", "ffprobe", "rclone"]) {
      if (!hay(h)) throw new Error(`No encuentro «${h}». Ejecuta preparar-pc.ps1, o: winget install ${h === "rclone" ? "Rclone.Rclone" : "Gyan.FFmpeg"}`);
    }
    soltar = tomarCandado(join(local, "sincronizar.lock"));
    const config = await leerConfig(preguntarTexto);
    const pass = await contrasenaDeRclone(rl);
    const ejecutar = crearEjecutar(registrar, pass ? { ...process.env, RCLONE_CONFIG_PASS: pass } : process.env);
    const nube = crearNubeRclone(config, ejecutar);
    const raiz = op.carpeta ?? join(homedir(), "Downloads", "Peliculas");
    if (!existsSync(raiz)) throw new Error(`No existe la carpeta ${raiz}.`);
    const trabajo = join(tmpdir(), "canalcasa");
    mkdirSync(trabajo, { recursive: true });

    const probarCodificador = (nombre) =>
      spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=size=256x256", "-frames:v", "1", "-c:v", nombre, "-f", "null", "-"], { windowsHide: true }).status === 0;
    const hayZscale = /zscale/.test(spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8", windowsHide: true }).stdout ?? "");
    if (!hayZscale) decir("aviso", "Este ffmpeg no trae «zscale»: una película HDR saldría con colores lavados. Instala la versión completa: winget install Gyan.FFmpeg");

    // Ctrl+C: se suelta el candado; la copia de trabajo se limpia en la siguiente vuelta.
    process.on("SIGINT", () => {
      soltar();
      console.log("\nCortado. Lo ya terminado queda hecho; vuelve a sincronizar para seguir.");
      process.exit(130);
    });

    const r = await sincronizar({ raiz, trabajo, nube, ejecutar, preguntar, decir, opciones: { ...op, probarCodificador, hayZscale } });
    if (!op.mirar && r.plan.length > 0) {
      decir(r.fallidas ? "aviso" : "bien", `Hecho: ${r.hechas} · sin hacer: ${r.saltadas} · con error: ${r.fallidas}`);
    }
    decir("info", `Registro: ${rutaRegistro}`);
    process.exitCode = r.fallidas ? 1 : 0;
  } catch (error) {
    decir("error", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    soltar();
    if (!op.sinPausa) await leerLinea("\nPulsa Enter para cerrar");
    rl.close();
  }
}

await principal();
