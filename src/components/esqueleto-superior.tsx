/**
 * La silueta de la barra superior, para las pantallas de carga.
 *
 * No es adorno: **la barra de verdad vive dentro de cada página, no en un
 * layout compartido**, así que al navegar desaparece con todo lo demás. La
 * documentación de Next lo dice al revés —«shared layouts remain interactive
 * while new route segments load»— y aquí no hay layout que compartir: el
 * resultado era que pulsar «Cine y series» dejaba la pantalla NEGRA hasta que
 * el servidor terminaba, y parecía que el botón no había hecho nada.
 *
 * Dibujando la silueta, la barra no llega a irse a ojos de quien mira: se
 * apaga un instante y vuelve. Es la diferencia entre «está cargando» y «se
 * rompió».
 *
 * Sin ningún `[data-nav]`: si el mando pudiera enfocar algo de aquí, el foco
 * se perdería al sustituirse por la pantalla de verdad.
 */
export function EsqueletoSuperior() {
  return (
    <div className="esqueleto-barra" aria-hidden="true">
      <span className="esqueleto-marca" />
      <span className="esqueleto-destinos">
        {/* Seis, que son los destinos que hay. Anchos distintos para que no
            parezca una regla graduada. */}
        {[68, 76, 92, 78, 80, 66].map((ancho, i) => (
          <span key={i} style={{ width: ancho }} />
        ))}
      </span>
      <span className="esqueleto-reloj" />
    </div>
  );
}
