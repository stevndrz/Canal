/**
 * La configuración que SÍ puede ver el navegador.
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
 * Regla: nada fuera de este archivo y de `config.server.ts` lee `process.env`.
 * Si hace falta un ajuste nuevo, se añade en el que corresponda con su
 * comentario y su valor por defecto.
 *
 * **Qué va en cada uno.** Aquí, solo lo que puede acabar en el navegador sin
 * que pase nada: los `NEXT_PUBLIC_*`. Todo lo demás —credenciales, URLs de
 * origen— vive en `config.server.ts`, que lleva `import "server-only"` y falla
 * al compilar si alguien lo importa desde un componente cliente. Estaban
 * juntos, y el token de TMDB acabó en los paquetes de desarrollo del
 * navegador por ese camino.
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
} as const;
