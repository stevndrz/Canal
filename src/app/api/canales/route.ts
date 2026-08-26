import { paqueteDeCanales } from "@/lib/lista-canales";
import { excedeLimite, identificarCliente, respuestaLimite } from "@/lib/limite-peticiones";

/**
 * La lista completa de canales.
 *
 * El HTML de la portada solo lleva los ~200 canales que las dos pantallas
 * pintan al abrir; los 7.622 restantes llegan por aquí, en cuanto el navegador
 * ha pintado. La diferencia no es solo de bytes:
 *
 *  - **El HTML no se puede cachear** (`page.tsx` es `force-dynamic`, y explica
 *    ahí por qué). Esta respuesta **sí**: cinco minutos en el borde, que es
 *    justo lo que dura la caché de la lista M3U en memoria.
 *  - **Un JSON se interpreta mucho más rápido que un payload de React.** El
 *    flight de RSC se recorre construyendo el árbol; esto es un `JSON.parse` de
 *    un array de arrays, que es lo más barato que sabe hacer un navegador de
 *    televisor.
 *  - Y sobre todo: el televisor pinta la primera pantalla **antes** de que esto
 *    llegue, en vez de esperar a haber descargado los 7.822.
 *
 * Es de solo lectura y no lleva ninguna credencial: la lista M3U es pública.
 */

/**
 * Nunca prerenderizada.
 *
 * `m3u.ts` descarga con `cache: "no-store"` a propósito —la caché de datos de
 * Next descarta respuestas de más de 2 MB y estas listas las superan—, así que
 * intentar hacerla estática rompe la compilación. El `Cache-Control` de abajo
 * es lo que de verdad la cachea, y lo hace donde importa: en el borde.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Cachear en el borde no protege el origen del primer fallo de caché, y
  // construir esta respuesta son 7.822 canales. El mismo freno que el resto.
  if (excedeLimite(identificarCliente(request))) return respuestaLimite();

  try {
    const { json } = await paqueteDeCanales();

    /**
     * Sale sin comprimir de aquí, y eso es a propósito.
     *
     * Medido: `next start` no comprime las respuestas de las rutas de API —ni
     * esta ni `/api/buscar`—, solo el HTML. Se intentó comprimir desde la
     * propia ruta y **no se puede**: Next reescribe `Content-Encoding` y `Vary`
     * en el camino de salida, así que el cliente recibía el JSON en crudo con
     * una cabecera que ya no estaba. En Vercel —que es donde esto vive— lo
     * comprime el borde: 1,01 MB pasan a ser unos 276 KB.
     */
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Cinco minutos compartidos, y hasta una hora sirviendo la copia vieja
        // mientras se refresca por detrás: nadie espera a que se rehaga.
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch {
    /**
     * Que esto falle no apaga la aplicación: el HTML ya trajo los canales que
     * se están viendo. El estado sí tiene que cambiar —un 200 con lista vacía
     * sería indistinguible de «esta lista no tiene canales»— y el cliente
     * simplemente se queda con lo que ya tiene.
     */
    return Response.json(
      { error: "lista-no-disponible" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
