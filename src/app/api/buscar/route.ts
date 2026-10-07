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
  // No es un fallo: la interfaz ya pide «al menos dos letras» antes de llamar.
  if (consulta.length < 2 || consulta.length > MAX_CONSULTA) {
    return Response.json({ resultados: [] as CardItem[], disponible: true });
  }

  const fichas = await searchCatalog(consulta).catch(() => null);

  /**
   * TMDB no contestó, o no hay clave. Antes salía 200 con una lista vacía,
   * indistinguible de «no hay ninguna película con ese nombre»: la pantalla
   * decía «Sin resultados» a quien había escrito bien. Ahora el cuerpo lo
   * dice (`disponible: false`) y el estado también (503), para que se vea en
   * los registros. Y `no-store`: un fallo no se cachea, o la siguiente
   * búsqueda de lo mismo seguiría fallando con TMDB ya de vuelta.
   */
  if (fichas === null) {
    return Response.json(
      { resultados: [] as CardItem[], disponible: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    {
      resultados: fichas.map((ficha) => ({
        ...catalogToCard(ficha),
        mediaType: ficha.mediaType,
        id: ficha.id,
      })),
      disponible: true,
    },
    {
      // Media hora de caché compartida: buscar "batman" dos veces seguidas
      // no debe costar dos viajes a TMDB.
      headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    },
  );
}
