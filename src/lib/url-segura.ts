/**
 * Recorta una URL para poder escribirla en un registro.
 *
 * Las listas de los portales IPTV llevan la credencial en la consulta —
 * `get.php?username=juan&password=s3cr3t`, el formato Xtream Codes que reparte
 * casi todo el sector—, así que registrar `M3U_URL` entera dejaba la contraseña
 * en los registros de Vercel cada vez que el origen iba lento. Vale igual para
 * `EPG_URL` y para cualquier enlace firmado.
 *
 * Se conservan host y ruta, que es lo que hace falta para arreglar el fallo, y
 * se marca con `?…` que había consulta para que nadie busque un error donde no
 * lo hay. Una URL inválida no se devuelve tal cual: podría ser la credencial
 * mal pegada.
 */
export function paraRegistro(url: string): string {
  try {
    const { protocol, hostname, port, pathname, search, username } = new URL(url);
    const puerto = port ? `:${port}` : "";
    // `usuario:clave@host` es la otra forma de meterla, y `origin` no la incluye.
    const credencial = username ? "[credencial]@" : "";
    return `${protocol}//${credencial}${hostname}${puerto}${pathname}${search ? "?…" : ""}`;
  } catch {
    return "[url no válida]";
  }
}
