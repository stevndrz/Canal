/**
 * Calentar el catálogo en cuanto arranca el servidor.
 *
 * El síntoma: «Cine y series» tarda a veces hasta tres segundos, y peor nada
 * más desplegar — cuando la caché de datos de Next está fría o la instancia
 * es nueva, el primer visitante paga las doce peticiones a TMDB en vivo.
 *
 * `register()` corre una vez por instancia de servidor ANTES de que empiece a
 * atender peticiones. Rellenar la caché aquí —en paralelo, sin bloquear el
 * arranque— significa que casi nadie vuelve a encontrarla fría: las mismas
 * URLs que pedirán `/peliculas` y la portada ya están esperando.
 *
 * La llamada NO se espera (`void`): si TMDB está caída o lenta, no puede
 * retrasar el despliegue entero. Todo fallo se traga en silencio, igual que
 * `tmdbFetch` — la app funciona sin catálogo, como siempre diseñada para
 * sostenerse sola.
 */
export function register(): void {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  void (async () => {
    const inicio = Date.now();
    try {
      // Imports dinámicos: tiran del grafo del catálogo —catalog.json,
      // config.server— solo cuando toca, no en cada arranque del módulo.
      const { getCatalogSections } = await import("@/lib/catalog/catalog");
      const { fetchGenres } = await import("@/lib/catalog/tmdb");

      // Exactamente lo que pedirá `/peliculas`: diez filas más dos listas de
      // géneros, todas cacheadas un día (`tmdbFetch`). Con esto listo, la ruta
      // renderiza sin salir a la red.
      await Promise.all([getCatalogSections(), fetchGenres("movie"), fetchGenres("tv")]);
      console.log(`🔥 Catálogo de TMDB calentado en ${Date.now() - inicio} ms`);
    } catch (error) {
      console.error(`❌ No se pudo calentar el catálogo (${String(error)})`);
    }
  })();
}
