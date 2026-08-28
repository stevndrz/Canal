import { EsqueletoRieles } from "./esqueleto-rieles";

/**
 * La silueta de la portada: bloque grande de directo y dos rieles.
 *
 * La usan `app/loading.tsx` —el fallback del segmento raíz— y el `<Suspense>`
 * interior de la portada, que ocupa el hueco mientras baja la lista M3U. Antes
 * esa espera era entera, barra incluida; con `cacheComponents` el armazón está
 * prerenderizado y esto es lo único que falta rellenar.
 *
 * Es un esqueleto, no una ruleta: dibuja **dónde van a caer las cosas**, así
 * que al llegar no dan el salto de maquetación que da un indicador centrado. Y
 * no monta ni un solo `[data-nav]`: si el mando pudiera enfocar algo de aquí,
 * el foco se perdería al sustituirse por la pantalla de verdad.
 */
export function EsqueletoPortada() {
  return (
    <section className="content">
      <div className="live-slot">
        <div className="esqueleto-directo is-loading" />
      </div>

      <EsqueletoRieles claseTarjeta="esqueleto-tarjeta" />
    </section>
  );
}
