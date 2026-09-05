import "server-only";

/**
 * Lo que NO puede cruzar al navegador, jamás.
 *
 * Vivía junto a `publicConfig` en `config.ts`, y la fuga era real: un
 * componente cliente importa `providers.ts`, que importa `publicConfig`, así
 * que el módulo cruzaba al grafo del navegador y **solo el tree-shaking decidía
 * qué literal sobrevivía**. En producción el token no sobrevivía; con
 * `next dev` SÍ, y esta app se usa así en la red de casa. Prueba de que la
 * frontera era porosa: `CLAVE_VIMEUS`, del mismo grafo, sí llega al paquete de
 * producción.
 *
 * El `import "server-only"` convierte esa fuga en un error de compilación en
 * vez de dejarla al criterio del optimizador.
 *
 * **Aquí no va ninguna credencial escrita a fuego.** Hubo un token de TMDB de
 * reserva y hay que darlo por comprometido; ver `docs/SEGURIDAD.md`.
 */

/** Para que la app funcione recién clonada. `M3U_URL` la sustituye. */
const M3U_POR_DEFECTO =
  "https://gist.githubusercontent.com/stevndrz/8249817782d5a3c659f963f565916243/raw/8591ec832c3a5a04c311439cdcb82e6460a21f91/gistfile1.txt";

const TMDB_POR_DEFECTO = "https://api.themoviedb.org/3";

/**
 * Es una función y no un objeto constante porque en el navegador `process.env`
 * de estas claves está vacío, y un objeto evaluado al importar congelaría ese
 * vacío.
 */
export function serverConfig() {
  return {
    /** Lista de canales. La lee `m3u.ts`. */
    m3uUrl: process.env.M3U_URL || M3U_POR_DEFECTO,

    /** Interruptor de emergencia: manda los 7.822 canales en el HTML, como antes. */
    canalesEnHtml: process.env.CANALES_EN_HTML?.trim() === "todos",

    /** Guía XMLTV. Sin ella las filas no dicen qué están dando. */
    epgUrl: process.env.EPG_URL || "",

    /** Credencial de TMDB. La lee `catalog/tmdb.ts`. */
    tmdbCredencial: process.env.TMDB_API_KEY?.trim() || "",

    /** Addons de Stremio con enlaces directos, separados por comas. */
    stremioManifestos: process.env.STREMIO_MANIFESTS?.trim() || "",

    /**
     * A dónde se le pregunta a TMDB.
     *
     * Está aquí y no en `tmdb.ts` porque **la credencial se adjunta a lo que
     * diga esta variable**, en la URL o en una cabecera `Authorization`. Que se
     * lea donde se revisan las credenciales, no escondida en un módulo.
     */
    tmdbApiBase: baseDeTmdb(),
  };
}

/**
 * Comprueba la forma, **no el esquema**: `tmdb.ts` documenta que esto sirve
 * para apuntar a un espejo o a un simulador local, y eso vive en
 * `http://localhost`. Exigir https rompería el único caso de uso que justifica
 * la variable.
 *
 * La barra final sí se quita: quien lee concatena `${base}${ruta}` con rutas
 * que ya empiezan por `/`, y una de más produce `//movie/1`.
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
