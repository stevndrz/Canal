/**
 * Toda la configuración de CanalCasa, en un solo sitio.
 *
 * Antes cada módulo leía `process.env` por su cuenta con su propio criterio
 * para el valor por defecto: unos con `||`, otros con `?.trim() ||`, otros sin
 * nada. Eso hace imposible responder de un vistazo a "¿qué se puede
 * configurar?", que es justo lo que hay que saber para desplegar.
 *
 * **Los `process.env.NEXT_PUBLIC_*` se escriben literalmente**, nunca con
 * índice calculado: Next los sustituye por su valor en tiempo de compilación
 * buscando el texto exacto, así que `process.env[clave]` se quedaría vacío en
 * el navegador. Es la razón de que esto sea una lista escrita a mano y no un
 * bucle sobre un objeto.
 *
 * Regla: nada fuera de este archivo lee `process.env`. Si hace falta un ajuste
 * nuevo, se añade aquí con su comentario y su valor por defecto.
 */

/** Lo que el navegador puede ver. Solo `NEXT_PUBLIC_*` llega hasta aquí. */
export const publicConfig = {
  /**
   * Canal que se sintoniza al abrir la aplicación. Se busca por nombre en la
   * lista M3U; si no aparece, se usa el primero que haya.
   */
  canalInicial: process.env.NEXT_PUBLIC_CANAL_INICIAL || "Canal 7",

  /**
   * Proveedor de reproducción propio, que se antepone a los de la lista.
   * Sirve para apuntar a un servidor propio sin recompilar. Las plantillas
   * admiten `{tmdbId}`, `{season}` y `{episode}`.
   */
  embedPropioPelicula: process.env.NEXT_PUBLIC_EMBED_PROVIDER_MOVIE?.trim() || "",
  embedPropioSerie: process.env.NEXT_PUBLIC_EMBED_PROVIDER_TV?.trim() || "",

  /** Watch Party. Sin estas dos, «Ver en familia» se desactiva sola. */
  pusherKey: process.env.NEXT_PUBLIC_PUSHER_KEY || "",
  pusherCluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1",
} as const;

/**
 * Lista M3U por defecto.
 *
 * Está en el código a propósito: la aplicación tiene que funcionar recién
 * clonada, sin preparar nada. `M3U_URL` la sustituye.
 */
const M3U_POR_DEFECTO =
  "https://gist.githubusercontent.com/stevndrz/08bf27100aa1bd5fd518aa5b4e548b4f/raw/a46e30eeda0b2c319eed0cc6d2b8877b97f19207/gt.m3u";

/**
 * Credencial de TMDB de reserva, para que la app arranque sin configurar nada.
 *
 * ⚠️ **Está en el historial de Git para siempre.** Es un token de solo
 * lectura del catálogo público de TMDB —no da acceso a ninguna cuenta ni
 * permite modificar nada— y al no llevar el prefijo `NEXT_PUBLIC_` nunca sale
 * hacia el navegador. Aun así, si este repositorio deja de ser privado hay que
 * rotarlo en TMDB y dejar solo la variable de entorno.
 */
const TMDB_POR_DEFECTO =
  "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIxOWM5NTFlZDA5ZmNlYWRkOGJiMTUxOTY3ZTNmZTBhZCIsIm5iZiI6MTc4NzExNjQ2My4zMjgsInN1YiI6IjZhODUzYmFmZTAyYzI0YmQ2NjVlZmRkYSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.2NAHUg6NQAvJsI9zD_-wVaPA1-OU-LN7dCMFlx1ZbqU";

/**
 * Lo que solo existe en el servidor.
 *
 * Es una función y no un objeto constante porque en el navegador
 * `process.env` de estas claves está vacío, y un objeto evaluado al importar
 * congelaría ese vacío. Llamarla desde código de cliente es un error, y el
 * comentario de cada campo dice desde dónde se usa.
 */
export function serverConfig() {
  return {
    /** Lista de canales. La lee `src/lib/m3u.ts`, siempre en el servidor. */
    m3uUrl: process.env.M3U_URL || M3U_POR_DEFECTO,

    /**
     * Guía de programación en XMLTV. Sin ella la app funciona igual, solo que
     * las filas de canal no muestran qué están dando ahora.
     */
    epgUrl: process.env.EPG_URL || "",

    /** Credencial de TMDB. La lee `src/lib/catalog/tmdb.ts`. */
    tmdbCredencial: process.env.TMDB_API_KEY?.trim() || TMDB_POR_DEFECTO,

    /** Secreto de Pusher, solo para firmar canales privados en la ruta de auth. */
    pusherSecret: process.env.PUSHER_SECRET || "",

    /**
     * Manifiestos de addons de Stremio que sirven enlaces directos
     * (.mp4/.m3u8) sin anuncios, separados por comas. Opcional: sin esta
     * lista la ficha queda solo con los embeds.
     */
    stremioManifestos: process.env.STREMIO_MANIFESTS?.trim() || "",
  };
}
