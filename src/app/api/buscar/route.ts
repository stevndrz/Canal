import { searchCatalog } from "@/lib/catalog/discover";
import { catalogToCard, type CardItem } from "@/lib/media-item";

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
export async function GET(request: Request) {
  const consulta = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  // Con una sola letra TMDB devuelve ruido y gasta una petición por pulsación.
  if (consulta.length < 2) {
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
    // Que TMDB falle no puede romper la pantalla: los canales se siguen
    // buscando igual y esta mitad se queda vacía.
    return Response.json({ resultados: [] as CardItem[] }, { status: 200 });
  }
}
