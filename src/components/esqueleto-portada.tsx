/**
 * La silueta de la portada: bloque grande de directo y dos rieles.
 *
 * La usan DOS pantallas distintas por el mismo motivo:
 *
 * - `src/app/loading.tsx`, el fallback del segmento raíz.
 * - El `<Suspense>` interior de la portada (`page.tsx`), que ocupa el hueco
 *   mientras baja la lista M3U en tiempo real. Antes esa espera era entera —
 *   barra incluida, pantalla sin nada—; con `cacheComponents` el armazón está
 *   prerenderizado y este bloque es lo único que falta rellenar.
 *
 * Es un esqueleto, no una ruleta: dibuja **dónde van a caer las cosas**, así
 * que cuando llegan no dan el salto de maquetación que da un indicador
 * centrado. Y no monta ni un solo `[data-nav]`: si el mando pudiera enfocar
 * algo de aquí, el foco se perdería al sustituirse por la pantalla de verdad.
 */
export function EsqueletoPortada() {
  return (
    <>
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
    </>
  );
}
