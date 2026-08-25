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
