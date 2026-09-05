/**
 * ¿Es un iPhone (o un iPod)?
 *
 * Deliberadamente **no** incluye el iPad: ahí la Fullscreen API sí funciona
 * sobre elementos normales, y usar el reproductor del sistema sacrificaría
 * nuestros controles sin ganar nada. Y el iPad moderno se anuncia como
 * "Macintosh", así que buscarlo por nombre tampoco serviría.
 *
 * Lo consumen los dos reproductores y el hook de pantalla completa para
 * decidir cuándo la única vía es el reproductor nativo del sistema.
 */
export function esIPhone(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent);
}

/**
 * ¿Puntero "coarse" (mando, dedo) en vez de "fine" (ratón, trackpad)?
 *
 * No distingue mando de dedo — para eso hace falta ver si llega una tecla de
 * flecha real, que es lo que hace `useRemoteInput` en `use-spatial-nav.ts`.
 * Esto es solo la señal de arranque, antes de la primera pulsación: decide si
 * tiene sentido dibujar un foco inicial (ver `focusFirst`).
 */
export function esPunteroTosco(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

/**
 * ¿Es el navegador de un televisor?
 *
 * Se decide con el `User-Agent` para poder hacerlo en el SERVIDOR: la ficha
 * elige un servidor de respaldo en el primer render, y corregirlo al hidratar
 * llegaría tarde —el marco ya habría empezado a cargar—.
 *
 * Para qué se usa: en un televisor, VidSrc deja de ir primero. Su puerta de
 * Cloudflare Turnstile necesita un navegador moderno, y el de una Samsung Tizen
 * no lo es; cuando la puerta falla se recarga sola, sin fin. Ahí sus subtítulos
 * no están realmente disponibles —no hay vídeo que subtitular—, así que lo
 * honesto es arrancar en uno que reproduzca y dejar VidSrc a un botón,
 * etiquetado, para quien quiera intentarlo (a veces pasa).
 *
 * Un falso positivo no rompe nada: como mucho reordena los servidores.
 */
export function esTelevisorUA(userAgent: string): boolean {
  return /Tizen|Web0S|WebOS|SmartTV|Smart-TV|HbbTV|NetCast|VIDAA|BRAVIA|AppleTV|GoogleTV|Android TV|CrKey|Roku|PhilipsTV|AFT[A-Z]/i.test(
    userAgent,
  );
}
