import type { ClaseFuente } from "./types";

/**
 * Qué es un enlace, mirando solo su forma.
 *
 * Deliberadamente **no** hace una petición para averiguarlo. Un `HEAD` contra
 * un servidor ajeno falla por CORS la mayoría de las veces y tardaría lo mismo
 * que intentar reproducir directamente. La extensión acierta en la práctica, y
 * cuando no acierta, `desconocida` cae en HLS, que es el formato dominante.
 *
 * Misma regla que `getStreamKind` en `stream-player.tsx`, a propósito: si un
 * día cambia una, tiene que cambiar la otra.
 */
export function claseDeUrl(url: string): ClaseFuente {
  const limpia = url.toLowerCase().split("?")[0].split("#")[0];
  if (/\.m3u8$/.test(limpia)) return "hls";
  if (/\.(ts|flv)$/.test(limpia)) return "mpegts";
  if (/\.mkv$/.test(limpia)) return "matroska";
  if (/\.(mp4|webm|mov|m4v)$/.test(limpia)) return "nativo";
  return "desconocida";
}

/**
 * Aviso honesto sobre `.mkv`, o cadena vacía si no hace falta ninguno.
 *
 * Matroska es un **contenedor**, no un códec, y ningún navegador lo reproduce
 * de forma fiable: Chrome abre algunos si por dentro llevan H.264 y AAC, y
 * Safari y Firefox no abren prácticamente ninguno. El enlace se acepta igual
 * —a veces funciona y no somos quién para prohibirlo— pero se dice antes de
 * intentarlo, en lugar de dejar un rectángulo negro sin explicación.
 */
export function avisoDeClase(clase: ClaseFuente): string {
  if (clase === "matroska") {
    return "Los archivos .mkv casi nunca se reproducen en un navegador: es un contenedor que depende de lo que lleve dentro. Si no arranca, convertirlo a .mp4 lo arregla.";
  }
  if (clase === "desconocida") {
    return "No se reconoce el formato por el enlace. Se intentará como HLS, que es lo más habitual.";
  }
  return "";
}

/** Nombre por defecto: el del archivo, sin extensión ni guiones. */
export function tituloDesdeUrl(url: string): string {
  try {
    const ruta = new URL(url).pathname;
    const archivo = decodeURIComponent(ruta.split("/").filter(Boolean).pop() ?? "");
    const sinExtension = archivo.replace(/\.[a-z0-9]{2,5}$/i, "");
    const legible = sinExtension.replace(/[._-]+/g, " ").trim();
    return legible || "Fuente sin título";
  } catch {
    return "Fuente sin título";
  }
}

/**
 * ¿Se puede intentar reproducir este enlace?
 *
 * Solo `http` y `https`. Es la comprobación que impide que un `javascript:` o
 * un `data:` pegado en el campo acabe en el `src` de un `<video>`.
 */
export function urlUtilizable(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
