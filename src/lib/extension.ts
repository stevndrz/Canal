/**
 * La extensión de una URL, que es de lo único que se puede deducir el formato
 * de un enlace sin salir a la red.
 *
 * Existe porque el mismo trozo de código estaba escrito tres veces —en
 * `reproduccion/motor.ts`, en `fuente-propia/url.ts` y en `native-player.tsx`—
 * y cada copia recortaba de forma distinta: una quitaba la consulta, otra la
 * consulta y el ancla, la tercera solo la consulta. Un `.m3u8#t=10` se
 * clasificaba bien en un sitio y mal en otro.
 *
 * Lo que **no** hace es unificar los tres vocabularios. Cada uno responde a una
 * pregunta distinta y deben seguir separados: `claseDeEmision` responde «qué
 * librería reproduce esto», `claseDeUrl` responde «qué le digo a quien acaba de
 * pegar un enlace». Que `.mkv` sea `native` para uno y `matroska` para el otro
 * no es una incoherencia, es que a un `<video>` se le puede dar y a una persona
 * hay que avisarla.
 *
 * Lo que sí se comparte es esto: de dónde se saca la extensión.
 */

/**
 * La extensión en minúsculas y sin punto, o cadena vacía si no hay.
 *
 * Se quitan la consulta y el ancla antes de mirar. Los enlaces firmados de los
 * servidores de descarga directa llevan la firma en la consulta
 * (`...mp4?token=…&e=43200`), así que sin recortarla la extensión sería
 * `mp4?token=…` y no coincidiría con nada.
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
