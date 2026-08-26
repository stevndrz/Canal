import { EsqueletoSuperior } from "@/components/esqueleto-superior";
import { EsqueletoCatalogo } from "@/components/esqueleto-catalogo";

/**
 * Lo que se ve al entrar en Cine y series.
 *
 * Existe por un fallo concreto: pulsar «Cine y series» **no hacía nada
 * visible** hasta que se pulsaba otro botón. No era el enlace, era que la
 * barra superior vive dentro de cada página y desaparecía con ella, dejando la
 * pantalla negra mientras el servidor pedía las diez listas de TMDB.
 *
 * La documentación de Next dice que este fallback **se prefetchea**, así que
 * con el archivo puesto la respuesta al clic es inmediata. Por eso no hace
 * falta `useLinkStatus`: eso está pensado justo para cuando NO hay `loading`.
 *
 * La página también lleva su propio `<Suspense>` con el mismo esqueleto
 * (`EsqueletoCatalogo`): ese es el que cubre el tramo largo —las listas de
 * TMDB streameando— cuando el armazón de la página ya está servido y esta
 * pantalla ya dejó de hacer falta.
 */
export default function CargandoCatalogo() {
  return (
    <div className="app-shell bg-black" aria-busy="true" aria-label="Cargando Cine y series">
      <EsqueletoSuperior />
      <EsqueletoCatalogo />
    </div>
  );
}
