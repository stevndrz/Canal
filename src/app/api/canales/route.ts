import { paqueteDeCanales } from "@/lib/lista-canales";
import { excedeLimite, identificarCliente, respuestaLimite } from "@/lib/limite-peticiones";

/**
 * La lista completa de canales.
 *
 * El HTML de la portada solo lleva los ~200 que las dos pantallas pintan al
 * abrir; los 7.622 restantes llegan por aquí en cuanto el navegador ha pintado.
 * La diferencia no es solo de bytes:
 *
 *  - **El HTML no se puede cachear** y esta respuesta sí: cinco minutos en el
 *    borde, justo lo que dura la caché de la M3U en memoria.
 *  - **Un JSON se interpreta mucho más rápido que un payload de React**: esto
 *    es un `JSON.parse` de un array de arrays, lo más barato que sabe hacer un
 *    navegador de televisor.
 *  - Y sobre todo: el televisor pinta la primera pantalla **antes** de que esto
 *    llegue.
 *
 * De solo lectura y sin credenciales: la lista M3U es pública.
 */
export async function GET(request: Request) {
  // Cachear en el borde no protege el origen del primer fallo de caché, y
  // construir esta respuesta son 7.822 canales.
  if (excedeLimite(identificarCliente(request))) return respuestaLimite();

  try {
    const { json, etag } = await paqueteDeCanales();

    /**
     * La tele abre la app varias veces al día y la lista casi nunca cambia:
     * cada apertura bajaba ~200 KB (comprimidos) para obtener lo mismo. Con la
     * huella, el navegador pregunta «¿sigue siendo esta?» y, si sí, la
     * respuesta es un 304 sin cuerpo.
     */
    const cabeceras = {
      "Content-Type": "application/json; charset=utf-8",
      ETag: etag,
      // El navegador siempre pregunta (`max-age=0`); el borde guarda cinco
      // minutos, y hasta una hora sirviendo la copia vieja mientras refresca.
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
    };
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: cabeceras });
    }

    /**
     * Sale sin comprimir a propósito. Medido: `next start` no comprime las
     * rutas de API, solo el HTML, y comprimir desde aquí **no se puede** —Next
     * reescribe `Content-Encoding` y `Vary` de salida, así que el cliente
     * recibía el JSON en crudo con una cabecera que ya no estaba. En Vercel lo
     * comprime el borde: 1,01 MB pasan a unos 276 KB.
     */
    return new Response(json, { headers: cabeceras });
  } catch {
    /**
     * Que esto falle no apaga la app: el HTML ya trajo los canales que se están
     * viendo. Pero el estado sí cambia — un 200 con lista vacía sería
     * indistinguible de «esta lista no tiene canales».
     */
    return Response.json(
      { error: "lista-no-disponible" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
