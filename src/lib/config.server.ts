import "server-only";

/**
 * Lo que NO puede cruzar al navegador, jamás.
 *
 * Vivía junto a `publicConfig` en `config.ts`, y eso era un problema real, no
 * teórico: `providers.ts` importa `publicConfig`, y `ficha-reproductor.tsx`
 * —que es un componente cliente— importa `providers.ts`. El módulo entero
 * cruzaba al grafo del navegador y **solo el tree-shaking decidía qué literal
 * sobrevivía**. En producción el token de TMDB no sobrevivía; en desarrollo
 * SÍ, y aparecía tal cual en los paquetes que sirve `npm run dev`. Como esta
 * app se usa con `next dev` en la red de casa, cualquiera con las herramientas
 * de desarrollo abiertas se lo llevaba.
 *
 * Prueba de que la frontera era porosa: `CLAVE_VIMEUS`, del mismo grafo, sí
 * llega al paquete de producción (es inocua —viaja en la URL del iframe— pero
 * demuestra que el módulo cruzaba).
 *
 * El `import "server-only"` de arriba convierte esa fuga en un **error de
 * compilación** en cuanto alguien importe este archivo desde un componente
 * cliente. Ya no depende de que el optimizador tenga un buen día.
 */

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

    /**
     * Manifiestos de addons de Stremio que sirven enlaces directos
     * (.mp4/.m3u8) sin anuncios, separados por comas. Opcional: sin esta
     * lista la ficha queda solo con los embeds.
     */
    stremioManifestos: process.env.STREMIO_MANIFESTS?.trim() || "",
  };
}
