#!/usr/bin/env node
/**
 * El panel de «Nuestras películas»: botones en vez de consola.
 *
 *   Doble clic en «CanalCasa Peliculas.cmd» (en Descargas\Peliculas).
 *
 * Abre en el navegador una página que solo existe en este PC
 * (http://127.0.0.1:<puerto>/?t=<token>) con la lista de películas y cinco
 * cosas: Agregar película (de cualquier carpeta: se copia), Descargar desde
 * un enlace (directo a un .mkv o .mp4), Subir cambios (la sincronización de
 * siempre, con barra de progreso), Borrar (de la app y a la Papelera) y
 * Cambiar carpeta.
 *
 * Por dentro es el mismo motor que «Sincronizar peliculas.cmd»
 * (`lib/sincronizar.mjs`): mismas reglas, mismo candado, mismo registro.
 *
 * Seguridad: escucha solo en 127.0.0.1 (nadie de la red lo ve), cada
 * petición lleva un token aleatorio de esta sesión, y se rechaza cualquier
 * petición con otro Host u Origin (una web cualquiera abierta en el navegador
 * no puede pulsar los botones por ti). Las rutas de los archivos nunca vienen
 * del navegador: se borra o se sube lo que el propio panel encontró en la
 * carpeta.
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { agregarSubtitulos, agrupar, copiarALaBiblioteca } from "./lib/agregar.mjs";
import { leerBiblioteca } from "./lib/biblioteca.mjs";
import { descargarALaBiblioteca, leerEnlace } from "./lib/descargar.mjs";
import {
  capacidadesDeFfmpeg,
  carpetaLocal,
  carpetaPorDefecto,
  carpetaTrabajo,
  crearEjecutar,
  crearRegistro,
  faltaPrograma,
  guardarConfig,
  leerConfigGuardada,
  rcloneCifrado,
  refrescarPath,
  tomarCandado,
  vivo,
} from "./lib/entorno.mjs";
import { estado } from "./lib/estado.mjs";
import { crearEstadoPublico } from "./lib/estado-publico.mjs";
import { crearNubeRclone } from "./lib/nube.mjs";
import { crearLectorDeProgreso } from "./lib/progreso.mjs";
import { LIMITE_NUBE, borrarDeLaNube, sincronizar } from "./lib/sincronizar.mjs";
import { crearDialogos } from "./lib/windows.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const SIN_PESTANA_MS = 10 * 60_000;

/**
 * Todo lo de fuera entra por `deps`, para que una prueba monte el panel con
 * una nube que es una carpeta y diálogos que contestan solos.
 */
export function crearPanel(deps = {}) {
  const d = {
    registro: deps.registro ?? crearRegistro("── panel"),
    leerConfig: leerConfigGuardada,
    guardarConfig,
    crearNube: (config, ejecutar) => crearNubeRclone(config, ejecutar),
    dialogos: deps.dialogos ?? crearDialogos(),
    faltaPrograma,
    rcloneCifrado,
    capacidades: capacidadesDeFfmpeg,
    tomarCandado,
    trabajo: carpetaTrabajo,
    carpetaPorDefecto,
    html: () => readFileSync(join(AQUI, "panel", "index.html"), "utf8"),
    descargar: descargarALaBiblioteca,
    alCerrar: () => {},
    ...deps,
  };
  const { registrar } = d.registro;
  const token = d.token ?? randomBytes(24).toString("hex");
  let puerto = 0;
  let contrasena = process.env.RCLONE_CONFIG_PASS ?? null;
  let ocupado = null;
  let progreso = null;
  const clientes = new Set();
  const historial = [];
  const preguntas = new Map();
  let ultimaPestana = Date.now();
  /** Corta la descarga en curso (null si no hay ninguna). */
  let cancelarDescarga = null;

  // ── Mensajes al navegador (Server-Sent Events) ────────────────────────────
  const emitir = (evento) => {
    if (evento.tipo === "mensaje") {
      historial.push(evento);
      if (historial.length > 300) historial.shift();
    }
    const linea = `data: ${JSON.stringify(evento)}\n\n`;
    for (const c of clientes) c.write(linea);
  };
  const decir = (nivel, texto) => {
    registrar(`${nivel}: ${texto}`);
    emitir({ tipo: "mensaje", nivel, texto });
  };
  const ponerProgreso = (p) => {
    progreso = p;
    emitir({ tipo: "progreso", progreso: p });
  };
  const ponerOcupado = (que) => {
    ocupado = que;
    emitir({ tipo: "ocupado", ocupado: que });
  };
  let siguientePregunta = 1;
  const preguntar = (texto, porDefecto) =>
    new Promise((resolver) => {
      const id = siguientePregunta++;
      preguntas.set(id, { texto, porDefecto, resolver });
      emitir({ tipo: "pregunta", id, texto, porDefecto });
    }).then((si) => {
      registrar(`? ${texto} → ${si ? "sí" : "no"}`);
      return si;
    });

  // ── Lo que necesita cada operación ────────────────────────────────────────
  const config = () => d.leerConfig();
  const raiz = () => config()?.carpeta || d.carpetaPorDefecto();
  const crearEjecutarCon = (alSalida) =>
    crearEjecutar(registrar, contrasena ? { ...process.env, RCLONE_CONFIG_PASS: contrasena } : process.env, alSalida);
  const nube = (alSalida = () => {}) => d.crearNube(config(), crearEjecutarCon(alSalida));

  /** Qué falta antes de poder hacer nada (null si nada). */
  const necesita = () => {
    const falta = d.faltaPrograma();
    if (falta) return { que: "programas", texto: falta };
    if (!config()) return { que: "config" };
    if (!contrasena && d.rcloneCifrado()) return { que: "contrasena" };
    if (!existsSync(raiz())) return { que: "carpeta", texto: `No existe la carpeta ${raiz()}.` };
    return null;
  };

  /** Falla si ahora mismo no se puede empezar nada. */
  const exigirLibre = () => {
    if (ocupado) throw Object.assign(new Error(`Espera: ahora mismo estoy ${ocupado}.`), { codigo: 409 });
    const falta = necesita();
    if (falta) throw Object.assign(new Error(falta.texto ?? "Falta configurar el panel."), { codigo: 409 });
  };

  /** Una operación a la vez, con el mismo candado que la consola. */
  const operar = async (que, fn) => {
    exigirLibre();
    let soltar = () => {};
    ponerOcupado(que);
    try {
      soltar = d.tomarCandado();
      return await fn();
    } catch (error) {
      decir("error", error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      soltar();
      ponerProgreso(null);
      ponerOcupado(null);
      emitir({ tipo: "cambio" });
    }
  };

  /** La fila que pide el navegador, buscada en lo que el panel ve ahora. */
  const buscarFila = async (clave) => {
    const e = await estado({ raiz: raiz(), nube: nube() });
    const fila = e.peliculas.find((f) => f.clave === clave);
    if (!fila) throw Object.assign(new Error("Esa película ya no está. Recarga la lista."), { codigo: 404 });
    return fila;
  };

  // ── Acciones ──────────────────────────────────────────────────────────────
  const acciones = {
    async estado() {
      const base = { raiz: raiz(), ocupado, progreso, limite: LIMITE_NUBE, necesita: necesita(), historial };
      if (base.necesita) return { ...base, peliculas: [], saltadas: [] };
      try {
        return { ...base, ...(await estado({ raiz: raiz(), nube: nube() })) };
      } catch (error) {
        return { ...base, peliculas: [], saltadas: [], error: error instanceof Error ? error.message : String(error) };
      }
    },

    async config(datos) {
      const anterior = config();
      d.guardarConfig({ ...datos, carpeta: anterior?.carpeta ?? null });
      decir("bien", "Configuración guardada.");
      return { ok: true };
    },

    async contrasena({ valor }) {
      const prueba = String(valor ?? "");
      const ejecutar = crearEjecutar(registrar, { ...process.env, RCLONE_CONFIG_PASS: prueba });
      try {
        await d.crearNube(config(), ejecutar).listarCarpetas();
      } catch {
        throw Object.assign(new Error("rclone no la aceptó. Prueba otra vez."), { codigo: 400 });
      }
      contrasena = prueba;
      return { ok: true };
    },

    sincronizar() {
      return operar("subiendo cambios", async () => {
        const lector = crearLectorDeProgreso(ponerProgreso);
        // El mismo avance, también para la app (`estado.json` en el bucket).
        let publico = null;
        const leer = (t) => {
          lector.leer(t);
          publico?.leer(t);
        };
        const n = nube(leer);
        publico = crearEstadoPublico({ nube: nube(), limite: LIMITE_NUBE, registrar });
        const { probarCodificador, hayZscale } = d.capacidades();
        if (!hayZscale) decir("aviso", "Este ffmpeg no trae «zscale»: una película HDR saldría con colores lavados. Instala la versión completa: winget install Gyan.FFmpeg");
        // «Subir cambios» ya es la confirmación del plan; borrar sigue preguntando.
        const preguntarAqui = (texto, porDefecto) => (texto === "¿Lo hago?" ? Promise.resolve(true) : preguntar(texto, porDefecto));
        const r = await sincronizar({
          raiz: raiz(),
          trabajo: d.trabajo(),
          nube: n,
          ejecutar: crearEjecutarCon(leer),
          preguntar: preguntarAqui,
          decir,
          opciones: {
            probarCodificador,
            hayZscale,
            alProgreso: (f) => {
              lector.fase(f);
              publico.fase(f);
            },
          },
        }).catch(async (error) => {
          await publico.fin({ fallo: true });
          throw error;
        });
        await publico.fin({ pendientes: r.pendientes.length, fallo: r.fallidas > 0 });
        if (r.plan.length > 0) decir(r.fallidas ? "aviso" : "bien", `Hecho: ${r.hechas} · sin hacer: ${r.saltadas} · con error: ${r.fallidas}`);
        return { hechas: r.hechas, fallidas: r.fallidas, saltadas: r.saltadas };
      });
    },

    async agregar() {
      if (ocupado) throw Object.assign(new Error(`Espera: ahora mismo estoy ${ocupado}.`), { codigo: 409 });
      const rutas = await d.dialogos.elegirPeliculas(raiz());
      if (!rutas?.length) return { cancelado: true };
      const grupos = await agrupar(rutas);
      return operar("copiando", async () => {
        const hechos = await copiarALaBiblioteca(grupos, raiz(), {
          decir,
          alAvance: (a) => ponerProgreso(a ? { fase: "copiar", titulo: a.titulo, porcentaje: a.porcentaje } : null),
        });
        for (const h of hechos) {
          decir("bien", `${h.yaEstaba ? "Ya estaba" : "Copiada"}: ${h.video}${h.subtitulos.length ? ` + ${h.subtitulos.join(", ")}` : ""}`);
        }
        return { hechos };
      });
    },

    /**
     * Baja un enlace directo a la carpeta. Larga: el avance va por
     * /api/eventos y al acabar se avisa con un evento «descargada».
     */
    descargar({ enlace } = {}) {
      return operar("descargando", async () => {
        const control = new AbortController();
        cancelarDescarga = () => control.abort();
        try {
          const r = await d.descargar(enlace, raiz(), {
            decir,
            senal: control.signal,
            alAvance: (a) => ponerProgreso(a ? { fase: "descargar", titulo: a.titulo, porcentaje: a.porcentaje } : null),
          });
          decir("bien", `${r.yaEstaba ? "Ya estaba" : "Descargada"}: ${r.video}`);
          emitir({ tipo: "descargada", video: r.video, yaEstaba: r.yaEstaba });
          return r;
        } catch (error) {
          // Cancelar lo pidió la persona: no es un error.
          if (!control.signal.aborted) throw error;
          decir("aviso", "Descarga cancelada. No quedó nada a medias en la carpeta.");
          return { cancelado: true };
        } finally {
          cancelarDescarga = null;
        }
      });
    },

    async cancelar() {
      if (!cancelarDescarga) return { ok: false };
      cancelarDescarga();
      return { ok: true };
    },

    async subtitulo({ clave }) {
      if (ocupado) throw Object.assign(new Error(`Espera: ahora mismo estoy ${ocupado}.`), { codigo: 409 });
      const fila = await buscarFila(clave);
      if (!fila.archivo) throw Object.assign(new Error("Esta película no está en el PC: pon el vídeo en la carpeta para añadirle subtítulos."), { codigo: 400 });
      const rutas = await d.dialogos.elegirSubtitulos(dirname(fila.archivo));
      if (!rutas?.length) return { cancelado: true };
      return operar("copiando subtítulos", async () => {
        const copiados = await agregarSubtitulos(rutas, fila.archivo, raiz());
        decir("bien", `Subtítulos de «${fila.titulo}»: ${copiados.join(", ")}. Pulsa «Subir cambios» para que lleguen a la app.`);
        return { copiados };
      });
    },

    borrar({ clave }) {
      return operar("borrando", async () => {
        const fila = await buscarFila(clave);
        // 1) El PC primero: si la nube fallara después, la siguiente vuelta la
        //    ve «solo en la nube» y pregunta. Al revés, se volvería a subir.
        if (fila.archivo) {
          const { peliculas } = await leerBiblioteca(raiz(), { ahora: Infinity });
          const local = peliculas.find((p) => p.video.ruta === fila.archivo);
          const carpeta = dirname(fila.archivo);
          const enSuCarpeta = carpeta !== raiz() && dirname(carpeta) === raiz();
          const rutas = enSuCarpeta ? [carpeta] : [fila.archivo, ...(local?.subtitulos ?? []).map((s) => s.ruta)];
          await d.dialogos.aPapelera(rutas);
          decir("bien", `«${fila.titulo}»: a la Papelera (${enSuCarpeta ? "su carpeta" : `${rutas.length} archivo(s)`}).`);
        }
        // 2) La nube.
        if (fila.enNube) {
          const n = nube();
          const catalogo = await n.leerCatalogo();
          const entrada = catalogo.find((e) => e.id === fila.id);
          if (entrada) await borrarDeLaNube(entrada, { catalogo, nube: n, decir });
        }
        return { ok: true };
      });
    },

    async carpeta() {
      const elegida = await d.dialogos.elegirCarpeta(raiz());
      if (!elegida) return { cancelado: true };
      const c = config();
      if (c) d.guardarConfig({ ...c, carpeta: elegida });
      decir("bien", `Carpeta: ${elegida}`);
      emitir({ tipo: "cambio" });
      return { carpeta: elegida };
    },

    async responder({ id, si }) {
      const p = preguntas.get(Number(id));
      if (!p) return { ok: false };
      preguntas.delete(Number(id));
      p.resolver(Boolean(si));
      emitir({ tipo: "respondida", id: Number(id) });
      return { ok: true };
    },

    async cerrar() {
      setTimeout(() => cerrar(), 150);
      return { ok: true };
    },
  };

  // ── HTTP ──────────────────────────────────────────────────────────────────
  const permitido = (req, url) => {
    const host = req.headers.host ?? "";
    if (host !== `127.0.0.1:${puerto}` && host !== `localhost:${puerto}`) return false;
    const origen = req.headers.origin;
    if (origen && origen !== `http://127.0.0.1:${puerto}` && origen !== `http://localhost:${puerto}`) return false;
    return (req.headers["x-token"] ?? url.searchParams.get("t")) === token;
  };
  const responder = (res, codigo, cuerpo, tipo = "application/json; charset=utf-8") => {
    res.writeHead(codigo, { "Content-Type": tipo, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
    res.end(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo));
  };
  const leerCuerpo = (req) =>
    new Promise((resolver, rechazar) => {
      let texto = "";
      req.on("data", (t) => {
        texto += t;
        if (texto.length > 100_000) req.destroy();
      });
      req.on("end", () => {
        try {
          resolver(texto ? JSON.parse(texto) : {});
        } catch {
          rechazar(Object.assign(new Error("JSON roto"), { codigo: 400 }));
        }
      });
      req.on("error", rechazar);
    });

  const servidor = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${puerto}`);
    if (!permitido(req, url)) return responder(res, 403, { error: "No." });
    try {
      if (req.method === "GET" && url.pathname === "/") {
        return responder(res, 200, d.html(), "text/html; charset=utf-8");
      }
      if (req.method === "GET" && url.pathname === "/api/eventos") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write(": hola\n\n");
        clientes.add(res);
        for (const [id, p] of preguntas) res.write(`data: ${JSON.stringify({ tipo: "pregunta", id, texto: p.texto, porDefecto: p.porDefecto })}\n\n`);
        req.on("close", () => {
          clientes.delete(res);
          ultimaPestana = Date.now();
        });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/estado") return responder(res, 200, await acciones.estado());
      const nombre = url.pathname.replace(/^\/api\//, "");
      if (req.method === "POST" && Object.hasOwn(acciones, nombre) && nombre !== "estado") {
        const cuerpo = await leerCuerpo(req);
        if (nombre === "sincronizar") {
          // Larga: se contesta ya y el avance va por /api/eventos.
          acciones.sincronizar().catch(() => {});
          return responder(res, 202, { ok: true });
        }
        if (nombre === "descargar") {
          // Lo que se sabe ya (enlace mal escrito, panel ocupado) se contesta
          // ahora; lo demás tarda y va por /api/eventos.
          leerEnlace(cuerpo.enlace);
          exigirLibre();
          acciones.descargar(cuerpo).catch(() => {});
          return responder(res, 202, { ok: true });
        }
        return responder(res, 200, await acciones[nombre](cuerpo));
      }
      return responder(res, 404, { error: "No existe." });
    } catch (error) {
      return responder(res, error?.codigo ?? 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  const latido = setInterval(() => {
    for (const c of clientes) c.write(": latido\n\n");
    if (clientes.size === 0 && !ocupado && Date.now() - ultimaPestana > SIN_PESTANA_MS) cerrar();
  }, 25_000);
  latido.unref();

  let cerrado = false;
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    clearInterval(latido);
    // Sin nadie para contestar, «no»: nunca se borra nada por cerrar la pestaña.
    for (const [, p] of preguntas) p.resolver(false);
    cancelarDescarga?.();
    for (const c of clientes) c.end();
    servidor.close();
    d.alCerrar();
  }

  return {
    token,
    async iniciar(p = 0) {
      await new Promise((resolver, rechazar) => {
        servidor.once("error", rechazar);
        servidor.listen(p, "127.0.0.1", resolver);
      });
      puerto = servidor.address().port;
      return `http://127.0.0.1:${puerto}/?t=${token}`;
    },
    cerrar,
  };
}

// ── Ejecutado a mano (CanalCasa Peliculas.cmd) ──────────────────────────────
function abrirNavegador(url) {
  if (process.env.CANALCASA_NO_ABRIR) return;
  const [cmd, args] =
    process.platform === "win32" ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } catch {
    // Si no se pudo, la URL está escrita en la ventana.
  }
}

async function principal() {
  refrescarPath();
  const rutaSesion = join(carpetaLocal(), "panel.json");
  // Doble clic con el panel ya abierto: se vuelve a enseñar el mismo.
  try {
    const previa = JSON.parse(readFileSync(rutaSesion, "utf8"));
    if (vivo(previa.pid)) {
      abrirNavegador(previa.url);
      console.log(`El panel ya estaba abierto: ${previa.url}`);
      return;
    }
  } catch {
    // No había otro.
  }
  const panel = crearPanel({
    alCerrar: () => {
      rmSync(rutaSesion, { force: true });
      console.log("Panel cerrado.");
      process.exit(0);
    },
  });
  const puertoPedido = Number(process.argv[process.argv.indexOf("--puerto") + 1]) || 0;
  const url = await panel.iniciar(process.argv.includes("--puerto") ? puertoPedido : 0);
  mkdirSync(carpetaLocal(), { recursive: true });
  writeFileSync(rutaSesion, JSON.stringify({ pid: process.pid, url }));
  console.log(`\nCanalCasa · Películas está abierto en el navegador:\n  ${url}\n\nNo cierres esta ventana mientras lo uses (se cierra sola 10 min después de cerrar la pestaña).`);
  abrirNavegador(url);
  process.on("SIGINT", () => panel.cerrar());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await principal();
