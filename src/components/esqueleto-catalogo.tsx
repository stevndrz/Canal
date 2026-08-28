import { EsqueletoRieles } from "./esqueleto-rieles";

/**
 * La silueta del contenido de Cine y series: banner y zona de catálogo.
 *
 * Se usa en dos sitios: `app/peliculas/loading.tsx`, el fallback del segmento
 * —lo que enseña el router antes de que llegue ni el armazón—, y el
 * `<Suspense>` interior de la propia página, donde el armazón y la barra ya
 * están en pantalla y esto ocupa el hueco mientras el servidor streamea las
 * filas. Antes, con TMDB lenta, había que esperar la página ENTERA.
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

        <EsqueletoRieles claseTarjeta="esqueleto-cartel" />
      </div>
    </>
  );
}
