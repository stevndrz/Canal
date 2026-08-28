/**
 * Cómo se escribe una URL de origen en un registro.
 *
 * Los registros de esta app nombran siempre el origen que falló —es lo primero
 * que hace falta para arreglarlo— y hasta ahora lo escribían entero. Con la
 * lista por defecto no pasa nada: es un Gist público. Pero `M3U_URL` es lo
 * primero que se cambia al desplegar, y las listas de los portales IPTV llevan
 * la credencial DENTRO de la URL:
 *
 *     http://portal.example:8080/get.php?username=juan&password=s3cr3t&type=m3u
 *
 * Ese formato (Xtream Codes) es el que reparte prácticamente todo el sector,
 * así que la ruta habitual es justo la peligrosa. Un origen lento —que es
 * exactamente cuando esto se registra— escribía la contraseña en los registros
 * de Vercel en cada intento, y esos registros los lee más gente que las
 * variables de entorno y se reenvían a servicios de terceros.
 *
 * Lo mismo vale para `EPG_URL` y para cualquier enlace firmado: el token va en
 * la consulta.
 */

/**
 * La URL que sí se puede registrar: origen y ruta, nunca la consulta.
 *
 * Se conserva el host y el camino porque sin ellos el mensaje no sirve para
 * nada, y se marca con `?…` que había consulta para que quien lee el registro
 * sepa que se recortó algo y no busque un error donde no lo hay.
 *
 * Si no es una URL válida no se devuelve el texto original —podría ser
 * justamente la credencial mal escrita—, sino una etiqueta.
 */
export function paraRegistro(url: string): string {
  try {
    const { protocol, hostname, port, pathname, search, username } = new URL(url);
    const puerto = port ? `:${port}` : "";
    // `https://usuario:clave@host/…` es la otra forma de meter credenciales en
    // una URL, y `origin` no la incluye — pero se avisa de que estaba.
    const credencial = username ? "[credencial]@" : "";
    return `${protocol}//${credencial}${hostname}${puerto}${pathname}${search ? "?…" : ""}`;
  } catch {
    return "[url no válida]";
  }
}
