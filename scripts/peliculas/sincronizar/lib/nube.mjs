import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * La nube (Cloudflare R2) a través de rclone.
 *
 * Por qué rclone y no un SDK: ya está configurado en el PC con la llave del
 * bucket, sube en trozos y reintenta solo, y no mete dependencias de npm.
 *
 * Todas las rutas son relativas al bucket («peliculas/coco-a1b2/master.m3u8»).
 * `ejecutar(programa, args)` lanza rclone SIN shell (los nombres de archivo
 * van como argumentos sueltos, no hay nada que escapar) y devuelve
 * `{ codigo, salida, error }`.
 */

export const CATALOGO = "peliculas/catalogo.json";
export const CATALOGO_ANTERIOR = "peliculas/catalogo.anterior.json";

/** El tipo de cada archivo se fija a mano: Windows dice que un .ts es TypeScript. */
export const TIPOS = [
  { patron: "*.ts", tipo: "video/mp2t", cache: "public, max-age=31536000, immutable" },
  { patron: "*.m3u8", tipo: "application/vnd.apple.mpegurl", cache: "public, max-age=300" },
  { patron: "*.vtt", tipo: "text/vtt; charset=utf-8", cache: "public, max-age=300" },
];

export function crearNubeRclone({ remoto, cubo, urlPublica }, ejecutar) {
  const base = `${remoto}:${cubo}`;
  const r = async (args, { mostrar = false } = {}) => {
    const resultado = await ejecutar("rclone", [...args, "--s3-no-check-bucket"], { mostrar });
    return resultado;
  };
  const exigir = async (args, que, opciones) => {
    const res = await r(args, opciones);
    if (res.codigo !== 0) throw new Error(`${que}: ${(res.error || res.salida || "").trim().split("\n").slice(-3).join(" ")}`);
    return res;
  };

  return {
    descripcion: `${base}`,
    urlPublica: (ruta) => `${urlPublica.replace(/\/+$/, "")}/${ruta}`,

    async listarCarpetas() {
      const res = await exigir(["lsf", `${base}/peliculas`, "--dirs-only"], "No pude listar la nube");
      return res.salida.split(/\r?\n/).map((l) => l.trim().replace(/\/$/, "")).filter(Boolean);
    },

    /**
     * El catálogo, o `[]` si todavía no existe. Si existe y no se pudo leer
     * (red caída, JSON roto), FALLA: tratarlo como vacío y escribir después
     * borraría todas las películas de la app.
     */
    async leerCatalogo() {
      const lista = await exigir(["lsf", `${base}/peliculas`, "--files-only"], "No pude listar la nube");
      if (!lista.salida.split(/\r?\n/).some((l) => l.trim() === "catalogo.json")) return [];
      const res = await exigir(["cat", `${base}/${CATALOGO}`], "No pude leer el catálogo");
      return leerJsonCatalogo(res.salida);
    },

    /** Guarda una copia del anterior y sube el nuevo (no-cache: la app lo ve al momento). */
    async escribirCatalogo(peliculas) {
      const carpeta = await mkdtemp(join(tmpdir(), "canalcasa-cat-"));
      try {
        const ruta = join(carpeta, "catalogo.json");
        await writeFile(ruta, JSON.stringify({ version: 2, peliculas }, null, 2), "utf8");
        // La copia de seguridad es dentro de la nube (sin bajar nada).
        await r(["copyto", `${base}/${CATALOGO}`, `${base}/${CATALOGO_ANTERIOR}`]);
        await exigir(
          ["copyto", ruta, `${base}/${CATALOGO}`, "--header-upload", "Content-Type: application/json; charset=utf-8", "--header-upload", "Cache-Control: no-cache"],
          "No pude guardar el catálogo",
        );
      } finally {
        await rm(carpeta, { recursive: true, force: true });
      }
    },

    /** Sube una carpeta entera con su tipo por archivo, y comprueba que llegó todo. */
    async subirCarpeta(local, remota) {
      for (const t of TIPOS) {
        await exigir(
          ["copy", local, `${base}/${remota}`, "--include", t.patron, "--transfers", "8", "--header-upload", `Content-Type: ${t.tipo}`, "--header-upload", `Cache-Control: ${t.cache}`, "--progress", "--retries", "5", "--low-level-retries", "20"],
          `Falló la subida (${t.patron})`,
          { mostrar: true },
        );
      }
      // Que no falte nada antes de apuntarla en el catálogo: si faltara un
      // trozo, la película se cortaría a la mitad en la tele.
      await exigir(["check", local, `${base}/${remota}`, "--one-way", "--size-only"], "La subida no llegó entera");
    },

    async subirArchivo(local, remota, tipo) {
      await exigir(
        ["copyto", local, `${base}/${remota}`, "--header-upload", `Content-Type: ${tipo}`, "--header-upload", "Cache-Control: public, max-age=300"],
        `No pude subir ${remota}`,
      );
    },

    async borrarCarpeta(remota) {
      await exigir(["purge", `${base}/${remota}`], `No pude borrar ${remota}`);
    },

    async borrarArchivo(remota) {
      const res = await r(["deletefile", `${base}/${remota}`]);
      // Si ya no estaba, da igual: el objetivo es que no esté.
      if (res.codigo !== 0 && !/not found|doesn't exist|no such/i.test(res.error ?? "")) {
        throw new Error(`No pude borrar ${remota}: ${(res.error ?? "").trim()}`);
      }
    },

    /** Bytes usados en la nube, o null si no se pudo saber. */
    async tamanoTotal() {
      const res = await r(["size", `${base}/peliculas`, "--json"]);
      if (res.codigo !== 0) return null;
      try {
        return JSON.parse(res.salida).bytes ?? null;
      } catch {
        return null;
      }
    },
  };
}

/** El JSON del catálogo → la lista; tolera el formato viejo y falla si está roto. */
export function leerJsonCatalogo(texto) {
  const limpio = texto.replace(/^﻿/, "").trim();
  if (!limpio) return [];
  let datos;
  try {
    datos = JSON.parse(limpio);
  } catch {
    throw new Error("El catálogo de la nube no es JSON válido. No toco nada; revísalo (hay una copia en catalogo.anterior.json).");
  }
  const lista = Array.isArray(datos?.peliculas) ? datos.peliculas : datos?.peliculas ? [datos.peliculas] : [];
  return lista.filter((p) => p && typeof p.id === "string");
}
