/**
 * Lo que se ve mientras la portada se arma en el servidor.
 *
 * La portada baja la lista M3U y consulta el catálogo de TMDB. Con eso, en
 * una tele lenta hay cerca de un segundo en el que antes solo había negro y
 * ninguna señal de que estuviera pasando algo — que es exactamente cuando
 * alguien vuelve a pulsar OK pensando que no le hizo caso.
 *
 * Con `cacheComponents` el armazón (barra incluida) está prerenderizado, así
 * que este fallback solo cubre el hueco de los datos; la silueta vive en
 * `EsqueletoPortada`, compartida con el Suspense interior de la portada.
 */
import { EsqueletoSuperior } from "@/components/esqueleto-superior";
import { EsqueletoPortada } from "@/components/esqueleto-portada";

export default function Cargando() {
  return (
    <div className="app-shell" aria-busy="true" aria-label="Cargando CanalCasa">
      <EsqueletoSuperior />
      <EsqueletoPortada />
    </div>
  );
}
