/**
 * La configuración que SÍ puede ver el navegador.
 *
 * **Los `process.env.NEXT_PUBLIC_*` se escriben literalmente**, nunca con
 * índice calculado: Next los sustituye en tiempo de compilación buscando el
 * texto exacto, así que `process.env[clave]` se quedaría vacío. Es la razón de
 * que esto sea una lista escrita a mano y no un bucle.
 *
 * Regla: nada fuera de este archivo y de `config.server.ts` lee `process.env`.
 * Aquí solo lo que puede acabar en el navegador sin que pase nada; lo demás va
 * en `config.server.ts`, que falla al compilar si lo importa un componente
 * cliente. Estaban juntos, y el token de TMDB acabó en los paquetes de
 * desarrollo por ese camino.
 */
export const publicConfig = {
  /** Se busca por nombre en la M3U; si no aparece, se usa el primero que haya. */
  canalInicial: process.env.NEXT_PUBLIC_CANAL_INICIAL || "Canal 7",

  /**
   * Los canales de la casa: los que se ven de cajón, **en cualquier aparato y
   * sin configurar nada en él**. Es lo que resuelve «que estén en la tele, en
   * mi PC y en el teléfono de mi mamá».
   *
   * Se emparejan por NOMBRE y no por id: el id es la posición en la lista y se
   * mueve en cuanto la M3U cambia de tamaño.
   */
  canalesDeCasa: (process.env.NEXT_PUBLIC_CANALES_CASA || "Canal 3, Canal 7, Guatevision")
    .split(",")
    .map((nombre) => nombre.trim())
    .filter(Boolean),

  /**
   * Servidor de embeds propio, delante de la lista. Admite `{tmdbId}`,
   * `{season}` y `{episode}`.
   */
  embedPropioPelicula: process.env.NEXT_PUBLIC_EMBED_PROVIDER_MOVIE?.trim() || "",
  embedPropioSerie: process.env.NEXT_PUBLIC_EMBED_PROVIDER_TV?.trim() || "",

  /**
   * Origen ABSOLUTO de esta app (sin barra final). Lo usa el HTML del proxy
   * de vimeus para reescribir las requests internas del player (fetch /
   * XHR) y mandarlas a `/api/proxy/vimeos-asset`, que es la única forma de
   * que `vimeos.net` no rechace las requests por `Referer` con un 403.
   *
   * En local sin definir, las requests van directas a `vimeos.net` y pueden
   * caer al 403; en Vercel con dominio propio se pone `https://tu-dominio`.
   */
  sitioUrl: process.env.NEXT_PUBLIC_SITIO_URL?.trim().replace(/\/+$/, "") || "",
} as const;
