/**
 * Los dos rieles que insinúan la forma mientras carga, compartidos por los
 * esqueletos de portada y de catálogo.
 *
 * Dos bastan, y **ninguna tarjeta brilla**: `.is-loading` anima
 * `background-position`, o sea un repintado por fotograma. Uno cuesta nada;
 * catorce a la vez es justo el adorno que arrastra a una tele vieja mientras
 * está armando la pantalla de verdad. El brillo se lo queda el bloque grande
 * de cada esqueleto; las tarjetas se quedan en relleno plano, que a tres
 * metros no se distingue y hace el mismo trabajo: reservar el sitio.
 */
export function EsqueletoRieles({ claseTarjeta }: { claseTarjeta: string }) {
  return (
    <>
      {[0, 1].map((riel) => (
        <div className="esqueleto-riel" key={riel}>
          <div className="esqueleto-titulo" />
          <div className="esqueleto-fila">
            {[0, 1, 2, 3, 4, 5].map((tarjeta) => (
              <div className={claseTarjeta} key={tarjeta} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
