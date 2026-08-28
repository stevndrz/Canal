import { searchCatalog } from "@/lib/catalog/discover";
import { catalogToCard, type CardItem } from "@/lib/media-item";
import { excedeLimite, identificarCliente, respuestaLimite } from "@/lib/limite-peticiones";

/**
 * Búsqueda de películas y series para la pantalla de Buscar.
 *
 * Existe porque la credencial de TMDB **no sale hacia el navegador**: no lleva
 * el prefijo `NEXT_PUBLIC_`, así que el cliente no puede consultar TMDB por su
 * cuenta. Esta ruta hace de intermediaria y devuelve las fichas ya traducidas
 * a `CardItem`, que es lo único que la tarjeta necesita.
 *
 * Los canales **no** pasan por aquí: la lista M3U ya está entera en el cliente
 * desde la primera carga, y filtrarla en memoria es instantáneo. Salir a la
 * red para eso sería más lento y para nada.
 */

/**
 * Tope de longitud de la consulta.
 *
 * TMDB no busca nada útil con más que esto, y sin tope cualquiera puede mandar
 * consultas enormes distintas entre sí: cada una es un fallo de caché y un
 * viaje a TMDB **con nuestra credencial**.
 */
const MAX_CONSULTA = 80;

export async function GET(request: Request) {
  // El límite de TMDB va contra la credencial, no contra quien llama: sin este
  // freno, esta ruta es un proxy gratuito de TMDB para cualquiera que descubra
  // la URL del despliegue.
  if (excedeLimite(identificarCliente(request))) return respuestaLimite();

  const consulta = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  // Con una sola letra TMDB devuelve ruido y gasta una petición por pulsación.
  if (consulta.length < 2 || consulta.length > MAX_CONSULTA) {
    return Response.json({ resultados: [] as CardItem[] });
  }

  try {
    const fichas = await searchCatalog(consulta);
    return Response.json(
      {
        resultados: fichas.map((ficha) => ({
          ...catalogToCard(ficha),
          mediaType: ficha.mediaType,
          id: ficha.id,
        })),
      },
      {
        // Media hora de caché compartida: buscar "batman" dos veces seguidas
        // no debe costar dos viajes a TMDB.
        headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
      },
    );
  } catch {
    /**
     * Que TMDB falle no puede romper la pantalla: los canales se siguen
     * buscando igual y esta mitad se queda vacía.
     *
     * Pero el estado **sí** cambia. Antes devolvía 200 con lista vacía, que es
     * indistinguible de «no hay resultados»: un fallo de TMDB —o alguien
     * agotando la cuota— era completamente invisible desde fuera. Con 502 el
     * cliente pinta lo mismo, y el fallo se puede ver en los registros y en el
     * panel de Vercel.
     */
    return Response.json(
      { resultados: [] as CardItem[], error: "catalogo-no-disponible" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
