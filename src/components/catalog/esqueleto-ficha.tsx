import { TopNav } from "@/components/shell/top-nav";
import { NavegacionCatalogo } from "./navegacion-catalogo";

/**
 * La silueta de una ficha mientras llega de TMDB.
 *
 * La ficha no tenía `loading.tsx` propio y el respaldo de su `<Suspense>` era
 * un `div` negro vacío, sin barra: medido, entre 300 y 530 ms de pantalla
 * negra total en un PC con buena red —más en una tele—, y en ese tiempo el
 * mando no tenía nada que hacer y Atrás no respondía. Parecía que la tarjeta
 * pulsada había roto la app.
 *
 * Ahora se ve lo que va a llegar: la barra de verdad (se puede cambiar de
 * sección sin esperar), la portada, la carátula, tres líneas de título y
 * datos, la fila de acciones y el marco 16:9 del vídeo. Atrás funciona desde
 * el primer fotograma porque va dentro de `NavegacionCatalogo`.
 *
 * La usan `loading.tsx` del segmento y el `<Suspense>` de la página: el mismo
 * dibujo a propósito, para que la pantalla no cambie dos veces.
 */
export function EsqueletoFicha() {
  return (
    <NavegacionCatalogo subirAlAbrir>
      <div className="app-shell" aria-busy="true" aria-label="Abriendo la ficha">
        <TopNav />
        <div className="esqueleto-ficha" aria-hidden="true">
          <div className="esqueleto-ficha-portada">
            <span className="esqueleto-ficha-cartel" />
            <span className="esqueleto-ficha-lineas">
              <span className="esqueleto-ficha-linea is-titulo" />
              <span className="esqueleto-ficha-linea is-media" />
              <span className="esqueleto-ficha-linea is-corta" />
            </span>
          </div>
          <div className="esqueleto-ficha-acciones">
            <span className="is-boton" />
            <span />
            <span />
          </div>
          <div className="esqueleto-ficha-video is-loading" />
        </div>
      </div>
    </NavegacionCatalogo>
  );
}
