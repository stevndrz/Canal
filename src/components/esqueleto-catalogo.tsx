import { EsqueletoRieles } from "./esqueleto-rieles";

/**
 * La silueta del contenido de Cine y series: héroe, cabecera y filas.
 *
 * Se usa en dos sitios: `app/peliculas/loading.tsx`, el fallback del segmento
 * —lo que enseña el router antes de que llegue ni el armazón—, y el
 * `<Suspense>` interior de la propia página, donde el armazón y la barra ya
 * están en pantalla y esto ocupa el hueco mientras el servidor streamea las
 * filas. Antes, con TMDB lenta, había que esperar la página ENTERA.
 *
 * Las medidas y el margen salen de las piezas de verdad (`.hero`,
 * `.catalogo-cabecera`, `.rail`): todo arranca en `--margen` y la cabecera es
 * una fila a la izquierda —campo, cuatro píldoras y el orden—, igual que la
 * pantalla que la sustituye. Si el esqueleto centra lo que luego va a la
 * izquierda, la pantalla pega un salto al llegar.
 */
export function EsqueletoCatalogo() {
  return (
    <div aria-hidden="true">
      {/* El héroe, que es lo que ocupa la pantalla al entrar. */}
      <div className="catalogo-esqueleto-hero is-loading" />

      <div className="catalogo-esqueleto">
        <span className="catalogo-esqueleto-titulo" />
        <div className="catalogo-esqueleto-controles">
          <span className="catalogo-esqueleto-campo" />
          {[84, 112, 92, 120].map((ancho, i) => (
            <span key={i} className="catalogo-esqueleto-pildora" style={{ width: ancho }} />
          ))}
        </div>
      </div>

      <EsqueletoRieles claseTarjeta="esqueleto-cartel" />
    </div>
  );
}
