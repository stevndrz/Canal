/**
 * Sincronizar sola: lo que hace falta para que Windows lance la sincronización
 * cada pocos minutos sin que nadie la abra. Funciones puras; quien toca
 * Windows (`schtasks`, el disco) es `tarea.mjs`.
 *
 * Por qué una tarea programada y no un programa que vigile la carpeta: un
 * vigilante es un proceso que hay que mantener vivo (arrancarlo con Windows,
 * resucitarlo si se cae) y que no sabe cuándo terminó una descarga. La tarea
 * la mantiene Windows, y «¿terminó la descarga?» ya lo responde la biblioteca:
 * no toca nada que se haya modificado en los últimos dos minutos.
 */

export const NOMBRE_TAREA = "CanalCasa\\Sincronizar peliculas";
export const CADA_MINUTOS = 10;
export const ARCHIVO_ESTADO = "Estado de la sincronizacion.txt";

/**
 * El lanzador sin ventana.
 *
 * Una tarea que ejecuta `node` abre una consola negra cada diez minutos, en
 * medio de lo que se esté haciendo. `wscript` con ventana 0 no enseña nada.
 * En VBScript las comillas dentro de una cadena se doblan.
 */
export function guionOculto(node, guion) {
  const entre = (texto) => `""${texto}""`;
  return [
    "' Lanza la sincronizacion de CanalCasa sin abrir ninguna ventana.",
    "' Lo crea y lo borra «Sincronizar sola»; no hace falta tocarlo.",
    `CreateObject("WScript.Shell").Run "${entre(node)} ${entre(guion)} --automatico", 0, False`,
    "",
  ].join("\r\n");
}

/** Los argumentos de `schtasks` para crear (o pisar) la tarea. */
export function argumentosCrear(rutaVbs, cada = CADA_MINUTOS) {
  if (/"/.test(rutaVbs)) throw new Error("La ruta del lanzador no puede llevar comillas.");
  return ["/Create", "/TN", NOMBRE_TAREA, "/TR", `wscript.exe "${rutaVbs}"`, "/SC", "MINUTE", "/MO", String(cada), "/F"];
}

export const argumentosQuitar = () => ["/Delete", "/TN", NOMBRE_TAREA, "/F"];
export const argumentosConsultar = () => ["/Query", "/TN", NOMBRE_TAREA, "/FO", "LIST"];

/**
 * El archivo que queda en la carpeta de películas: qué hizo la última vuelta
 * y, sobre todo, qué NO hizo porque había que preguntar. Texto llano, con
 * saltos de Windows, para abrirlo con el Bloc de notas.
 */
export function textoDeEstado({ cuando, resultado, error }) {
  const lineas = [`Ultima sincronizacion automatica: ${cuando}`, ""];
  if (error) {
    lineas.push("NO SE PUDO SINCRONIZAR:", `  ${error}`, "", "Abre «Sincronizar peliculas.cmd» para ver el detalle.");
    return lineas.join("\r\n") + "\r\n";
  }
  const { subidas = [], pendientes = [], hechas = 0, fallidas = 0 } = resultado;
  if (subidas.length > 0) lineas.push("Subidas y ya disponibles en la app:", ...subidas.map((t) => `  + ${t}`), "");
  else if (hechas > 0) lineas.push(`Cambios aplicados: ${hechas} (titulos o subtitulos).`, "");
  else if (fallidas === 0 && pendientes.length === 0) lineas.push("Todo al dia: la nube es igual que esta carpeta.", "");
  if (fallidas > 0) lineas.push(`Con error: ${fallidas}. Abre «Sincronizar peliculas.cmd» para ver cual y por que.`, "");
  if (pendientes.length > 0) {
    lineas.push(
      "PENDIENTE DE TI (la sincronizacion automatica nunca borra nada):",
      ...pendientes.map((p) => `  ? ${p}`),
      "",
      "Para decidirlo, abre «Sincronizar peliculas.cmd»: te lo pregunta uno a uno.",
      "",
    );
  }
  return lineas.join("\r\n");
}
