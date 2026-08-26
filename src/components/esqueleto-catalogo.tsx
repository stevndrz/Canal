/**
 * La silueta del contenido de Cine y series: banner y zona de catálogo.
 *
 * Se usa en DOS sitios que cargan a la vez pero por motivos distintos:
 *
 * - `src/app/peliculas/loading.tsx`, el fallback del segmento: es lo que
 *   enseña el router durante una navegación antes de que llegue ni siquiera
 *   el armazón de la página.
 * - El `<Suspense>` interior de la propia página. Allí el armazón —barra
 *   incluida— ya está en pantalla, y este bloque ocupa el hueco mientras el
 *   servidor streamea las filas: con TMDB lenta (arranque en frío, despliegue
 *   nuevo) antes había que esperar TODA la página entera; ahora la barra está
 *   arriba desde el primer fotograma y las filas van llegando detrás.
 *
 * Las medidas salen de las piezas de verdad (`.hero`, `.rail`) para que al
 * llegar el contenido no salte nada.
 */
export function EsqueletoCatalogo() {
  return (
    <>
      {/* El banner, que es lo que ocupa la pantalla al entrar. */}
      <div className="esqueleto-hero is-loading" />

      <div className="esqueleto-catalogo">
        <div className="esqueleto-titulo-grande" />
        <div className="esqueleto-buscador" />

        <div className="esqueleto-pildoras">
          {[74, 96, 82, 148].map((ancho, i) => (
            <span key={i} style={{ width: ancho }} />
          ))}
        </div>

        {/* Dos rieles de cartel. Solo el banner brilla: `.is-loading` anima
            `background-position`, o sea un repintado por fotograma, y catorce
            a la vez es justo el adorno que arrastra a una tele vieja mientras
            está armando la pantalla de verdad. */}
        {[0, 1].map((riel) => (
          <div className="esqueleto-riel" key={riel}>
            <div className="esqueleto-titulo" />
            <div className="esqueleto-fila">
              {[0, 1, 2, 3, 4, 5].map((cartel) => (
                <div className="esqueleto-cartel" key={cartel} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
