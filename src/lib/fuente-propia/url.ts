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

/** Parece un hash y no un nombre: largo, sin espacios y casi todo hexadecimal. */
function pareceHash(texto: string): boolean {
  const compacto = texto.replace(/\s+/g, "");
  if (compacto.length < 16) return false;
  const hex = (compacto.match(/[0-9a-f]/gi) ?? []).length;
  return hex / compacto.length > 0.8;
}

/**
 * Nombre por defecto: el del archivo, sin extensión ni guiones.
 *
 * Con un enlace normal sale bien. Con uno sacado de un servidor de descarga
 * directa —que es de donde vienen la mayoría— el archivo se llama
 * `azlpa-7415e0f3a89a00ce9b77067047cd2822844215bf.mp4`, y poner eso de título
 * es peor que no poner nada. Ahí se cae al nombre del servidor, que al menos
 * dice de dónde salió, y la persona puede escribir el suyo en el campo de al
 * lado.
 */
export function tituloDesdeUrl(url: string): string {
  try {
    const { pathname, hostname } = new URL(url);
    const archivo = decodeURIComponent(pathname.split("/").filter(Boolean).pop() ?? "");
    const legible = archivo
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[._-]+/g, " ")
      .trim();
    if (!legible || pareceHash(legible)) return hostname.replace(/^www\./, "");
    return legible;
  } catch {
    return "Fuente sin título";
  }
}

/**
 * ¿El enlace lleva firma y caducidad?
 *
 * Los servidores de descarga directa reparten URLs firmadas: un token y un
 * plazo. El de ejemplo trae `e=43200`, que son doce horas. Funcionan
 * perfectamente mientras duran, y luego dejan de funcionar sin avisar — así
 * que se avisa antes, o el fallo de mañana parecerá un fallo de la aplicación.
 */
export function esEnlaceFirmado(url: string): boolean {
  try {
    const params = new URL(url).searchParams;
    return ["t", "token", "s", "sig", "signature", "e", "expires", "exp"].some((clave) =>
      params.has(clave),
    );
  } catch {
    return false;
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
