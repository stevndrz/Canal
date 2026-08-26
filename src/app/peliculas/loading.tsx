import { EsqueletoSuperior } from "@/components/esqueleto-superior";

/**
 * Lo que se ve al entrar en Cine y series.
 *
 * Existe por un fallo concreto: pulsar «Cine y series» **no hacía nada
 * visible** hasta que se pulsaba otro botón. No era el enlace, era que la
 * barra superior vive dentro de cada página y desaparecía con ella, dejando la
 * pantalla negra mientras el servidor pedía las diez listas de TMDB. El
 * esqueleto que había era el de canales —dos rieles y una tarjeta de directo—,
 * que en esta ruta ni siquiera se parece a lo que va a llegar.
 *
 * La documentación de Next dice que este fallback **se prefetchea**, así que
 * con el archivo puesto la respuesta al clic es inmediata. Por eso no hace
 * falta `useLinkStatus`: eso está pensado justo para cuando NO hay `loading`.
 *
 * Las medidas salen de las piezas de verdad (`.hero`, `.rail`) para que al
 * llegar el contenido no salte nada.
 */
export default function CargandoCatalogo() {
  return (
    <div className="app-shell bg-black" aria-busy="true" aria-label="Cargando Cine y series">
      <EsqueletoSuperior />

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
    </div>
  );
}
