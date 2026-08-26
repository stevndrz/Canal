/**
 * Lo que se ve mientras la portada se arma en el servidor.
 *
 * La portada es dinámica: baja la lista M3U, la clasifica y consulta el
 * catálogo de TMDB. Con eso, en una tele lenta hay cerca de un segundo en el
 * que antes solo había negro y ninguna señal de que estuviera pasando algo —
 * que es exactamente cuando alguien vuelve a pulsar OK pensando que no le hizo
 * caso.
 *
 * Es un esqueleto, no una ruleta: dibuja **dónde van a caer las cosas**, así
 * que cuando llegan no dan el salto de maquetación que da un indicador
 * centrado. Y no monta ni un solo `[data-nav]`: si el mando pudiera enfocar
 * algo de aquí, el foco se perdería al sustituirse por la pantalla de verdad.
 */
export default function Cargando() {
  return (
    <div className="app-shell" aria-busy="true" aria-label="Cargando CanalCasa">
      <div className="esqueleto-barra" />

      <section className="content">
        <div className="live-slot">
          <div className="esqueleto-directo is-loading" />
        </div>

        {/**
         * Dos rieles bastan para insinuar la forma, y **solo el bloque grande
         * brilla**.
         *
         * `.is-loading` anima `background-position`, que es un repintado por
         * fotograma. Uno cuesta nada; quince a la vez —dos títulos y doce
         * tarjetas— es justo el tipo de adorno que hace que una tele vieja se
         * arrastre, y encima mientras está armando la pantalla de verdad. Las
         * tarjetas se quedan en relleno plano: a tres metros no se distingue,
         * y hacen el mismo trabajo, que es reservar el sitio.
         */}
        {[0, 1].map((riel) => (
          <div className="esqueleto-riel" key={riel}>
            <div className="esqueleto-titulo" />
            <div className="esqueleto-fila">
              {[0, 1, 2, 3, 4, 5].map((tarjeta) => (
                <div className="esqueleto-tarjeta" key={tarjeta} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
