/**
 * La extensión de una URL: lo único de lo que se puede deducir el formato sin
 * salir a la red.
 *
 * Estaba escrito tres veces —`motor.ts`, `fuente-propia/url.ts`,
 * `native-player.tsx`— y cada copia recortaba distinto, así que un `.m3u8#t=10`
 * se clasificaba bien en un sitio y mal en otro.
 *
 * Se comparte de dónde sale la extensión, **no los vocabularios**: que `.mkv`
 * sea `native` para uno y `matroska` para el otro no es incoherencia — a un
 * `<video>` se le puede dar y a una persona hay que avisarla.
 */

/**
 * En minúsculas y sin punto, o vacío. Se recortan consulta y ancla: los enlaces
 * firmados llevan la firma en la consulta (`...mp4?token=…`) y sin recortarla
 * la extensión no coincidiría con nada.
 */
export function extensionDe(url: string): string {
  const ruta = url.toLowerCase().split("?")[0].split("#")[0];
  const punto = ruta.lastIndexOf(".");
  const barra = ruta.lastIndexOf("/");
  // El punto tiene que ir después de la última barra: si no, es parte del
  // dominio (`https://cdn.ejemplo.com/canal`) y no una extensión.
  if (punto < 0 || punto < barra) return "";
  return ruta.slice(punto + 1);
}
