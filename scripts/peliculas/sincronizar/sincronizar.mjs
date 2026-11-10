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

import { existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  capacidadesDeFfmpeg,
  carpetaLocal,
  carpetaPorDefecto,
  carpetaTrabajo,
  crearEjecutar,
  crearRegistro,
  faltaPrograma,
  leerConfig,
  rcloneCifrado,
  tomarCandado,
} from "./lib/entorno.mjs";
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

// ── Contraseña de rclone, sin que se vea al escribir ────────────────────────
async function contrasenaDeRclone(rl) {
  if (process.env.RCLONE_CONFIG_PASS) return process.env.RCLONE_CONFIG_PASS;
  if (!rcloneCifrado()) return null;
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

// ── Principal ───────────────────────────────────────────────────────────────
async function principal() {
  let op = {};
  let errorDeOpciones = null;
  try {
    op = leerOpciones(process.argv.slice(2));
  } catch (error) {
    errorDeOpciones = error;
  }
  const { ruta: rutaRegistro, registrar } = crearRegistro(`── sincronizar ${process.argv.slice(2).join(" ")}`);

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
    const falta = faltaPrograma();
    if (falta) throw new Error(falta);
    mkdirSync(carpetaLocal(), { recursive: true });
    soltar = tomarCandado();
    const config = await leerConfig(preguntarTexto);
    const pass = await contrasenaDeRclone(rl);
    const ejecutar = crearEjecutar(registrar, pass ? { ...process.env, RCLONE_CONFIG_PASS: pass } : process.env);
    const nube = crearNubeRclone(config, ejecutar);
    const raiz = op.carpeta ?? config.carpeta ?? carpetaPorDefecto();
    if (!existsSync(raiz)) throw new Error(`No existe la carpeta ${raiz}.`);
    const trabajo = carpetaTrabajo();

    const { probarCodificador, hayZscale } = capacidadesDeFfmpeg();
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
