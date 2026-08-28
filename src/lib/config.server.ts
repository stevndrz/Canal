import "server-only";

/**
 * Lo que NO puede cruzar al navegador, jamás.
 *
 * Vivía junto a `publicConfig` en `config.ts`, y la fuga era real: un
 * componente cliente importa `providers.ts`, que importa `publicConfig`, así
 * que el módulo cruzaba al grafo del navegador y **solo el tree-shaking
 * decidía qué literal sobrevivía**. En producción el token no sobrevivía; con
 * `next dev` SÍ, y esta app se usa así en la red de casa.
 *
 * Prueba de que la frontera era porosa: `CLAVE_VIMEUS`, del mismo grafo, sí
 * llega al paquete de producción. Es inocua, pero demuestra que cruzaba.
 *
 * El `import "server-only"` convierte esa fuga en un **error de compilación**
 * en vez de dejarla al criterio del optimizador.
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
 * **Aquí NO va ninguna credencial de TMDB.**
 *
 * Hubo una escrita a fuego como reserva, «para que arranque sin configurar
 * nada». El repositorio **es público**, así que ese token lo podía leer
 * cualquiera, y sigue en el historial de git: quitarlo del código no lo
 * desactiva — hay que regenerarlo en themoviedb.org.
 *
 * Sin `TMDB_API_KEY` la app sigue funcionando: los canales en directo no
 * dependen de TMDB, y Cine y series lo dice en pantalla en vez de salir vacía.
 * Ver `isTmdbConfigured()` en `catalog/tmdb.ts`.
 */

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
    tmdbCredencial: process.env.TMDB_API_KEY?.trim() || "",

    /**
     * Manifiestos de addons de Stremio que sirven enlaces directos
     * (.mp4/.m3u8) sin anuncios, separados por comas. Opcional: sin esta
     * lista la ficha queda solo con los embeds.
     */
    stremioManifestos: process.env.STREMIO_MANIFESTS?.trim() || "",
  };
}
