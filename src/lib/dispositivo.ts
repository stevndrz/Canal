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
 * ¿Es el navegador de un televisor?
 *
 * Se separa de `esTelevisor()` para poder decidirlo también en el SERVIDOR, a
 * partir de la cabecera `User-Agent`. Importa que se decida ahí: si el orden de
 * los servidores se corrigiera solo al hidratar, el marco ya habría empezado a
 * cargar el proveedor equivocado — y con él su bucle.
 *
 * La lista cubre lo que hay en un salón: Tizen (Samsung), webOS (LG), y las
 * marcas y cajas que se anuncian con nombre propio. Un falso positivo no rompe
 * nada: como mucho reordena los servidores de una ficha.
 */
export function esTelevisorUA(userAgent: string): boolean {
  return /Tizen|Web0S|WebOS|SmartTV|Smart-TV|SMART-TV|HbbTV|NetCast|VIDAA|BRAVIA|AppleTV|GoogleTV|Android TV|CrKey|Roku|PhilipsTV|AFT[A-Z]/i.test(
    userAgent,
  );
}

/** Lo mismo, desde el navegador. */
export function esTelevisor(): boolean {
  return esTelevisorUA(navigator.userAgent);
}
