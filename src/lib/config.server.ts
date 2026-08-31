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
     * Marcha atrás del recorte de la portada: manda los 7.822 canales dentro
     * del HTML, como se hacía antes. La lee `src/app/page.tsx`.
     *
     * Estaba leída con `process.env` allí mismo. Es un interruptor de
     * emergencia para producción, así que conviene que salga en la lista de lo
     * que se puede configurar y no escondido en el cuerpo de una función.
     */
    canalesEnHtml: process.env.CANALES_EN_HTML?.trim() === "todos",

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

    /**
     * A dónde se le pregunta a TMDB. La lee `src/lib/catalog/tmdb.ts`.
     *
     * Vivía ahí, leída con `process.env` directo, y era el único sitio del
     * proyecto que se saltaba la regla de arriba. Importa más de lo que
     * parece: **la credencial se adjunta a lo que diga esta variable**, en la
     * URL o en una cabecera `Authorization`. Quien pueda escribir una variable
     * de entorno en el despliegue se lleva el token con solo apuntar aquí.
     * Sacarla a este archivo no lo impide —quien toca el entorno toca lo que
     * quiere— pero la pone donde se revisa, en vez de escondida en un módulo.
     */
    tmdbApiBase: baseDeTmdb(),
  };
}

/** La base de TMDB por defecto: la API pública. */
const TMDB_POR_DEFECTO = "https://api.themoviedb.org/3";

/**
 * Comprueba la forma, **no el esquema**.
 *
 * Deliberadamente no se exige `https`. `tmdb.ts` documenta para qué existe
 * esto: apuntar a un espejo, o a un simulador local para probar lentitud y
 * caídas sin tocar producción — y eso vive en `http://localhost`. Exigir https
 * rompería el único caso de uso que justifica la variable.
 *
 * Lo que sí se comprueba es que sea una URL y que no acabe en barra: quien la
 * lee concatena `${base}${ruta}` con rutas que ya empiezan por `/`, así que una
 * barra de más produce `//movie/1` y una petición rota difícil de explicar.
 */
function baseDeTmdb(): string {
  const crudo = process.env.TMDB_API_BASE?.trim();
  if (!crudo) return TMDB_POR_DEFECTO;

  try {
    new URL(crudo);
  } catch {
    console.error(`❌ TMDB_API_BASE no es una URL válida; se usa la API pública — ${crudo}`);
    return TMDB_POR_DEFECTO;
  }

  return crudo.replace(/\/+$/, "");
}
