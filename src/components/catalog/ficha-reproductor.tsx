"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Info } from "lucide-react";
import { ServerPicker } from "./server-picker";
import {
  buildEmbedUrl,
  getProviders,
  ordenarParaTelevisor,
  type EmbedProvider,
} from "@/lib/catalog/providers";
import type { ManualStream, MediaType, PlaybackSource } from "@/lib/catalog/types";
import type { RespuestaStream, ServidorStream } from "@/lib/resolvers/types";
import { registrarCarga, type ConteoDeCargas } from "@/lib/reproduccion/marco-en-bucle";

/**
 * Cuánto se espera antes de ofrecer el cambio de servidor.
 *
 * Suficiente para que un embed lento arranque —una tele vieja tarda—, poco
 * para no dejar a nadie mirando una rueda sin saber que hay salida.
 */
const ESPERA_ANTES_DE_OFRECER_MS = 12_000;

/**
 * Lo mismo, para los proveedores con puerta antirrobot.
 *
 * Cuatro segundos: de esos ya se sabe CÓMO fallan —la puerta se recarga sola
 * y el marco no arranca nunca—, así que se baja a lo justo para no cortarle
 * el arranque a una tele lenta que sí iba a cargar. Esperar doce segundos a algo que no va a
 * pasar es justo lo que se sentía como «se queda cargando». El bucle no se
 * puede ver desde fuera —vive en un marco nieto—, pero sí se puede acortar la
 * espera hasta la salida.
 */
const ESPERA_CON_PUERTA_MS = 4_000;

// El reproductor nativo arrastra hls.js: solo se descarga si la ficha usa un
// enlace propio, no cuando se delega en el iframe del proveedor.
const NativePlayer = dynamic(() => import("@/components/native-player"), {
  ssr: false,
  loading: () => <div className="ficha-marco is-cargando" />,
});

/**
 * El reproductor de una ficha.
 *
 * - **Enlace propio** (`manual`): un `<video>` nuestro con controles completos.
 * - **Catálogo de TMDB** (`embed`): la lista de servidores (embeds) la arma
 *   la ruta `/api/stream` y el cambio entre ellos lo hace la persona con los
 *   botones de siempre, porque desde fuera de cada servidor no hay forma
 *   honesta de saber si funciona.
 */
export function FichaReproductor({
  fuente,
  titulo,
  tmdbId,
  mediaType,
  temporada,
  episodio,
  spokenInSpanish,
  enTelevisor,
  servidoresIniciales,
}: {
  fuente: PlaybackSource;
  titulo: string;
  /** Sin tmdbId no hay catálogo que consultar: solo sirven los enlaces propios. */
  tmdbId: number | null;
  mediaType: MediaType;
  temporada: number;
  episodio: number;
  spokenInSpanish: boolean;
  /** Lo decide el servidor con el `User-Agent`; ver `respaldo`. */
  enTelevisor: boolean;
  /**
   * Los servidores que **ya se comprobó** que tienen el título, calculados en
   * el servidor antes de pintar. Ver `lib/catalog/disponibilidad.ts`.
   */
  servidoresIniciales?: ServidorStream[];
}) {
  if (fuente.kind === "manual") {
    return (
      <section className="ficha-reproductor">
        <NativePlayer streams={fuente.streams} title={titulo} />
      </section>
    );
  }

  if (!tmdbId) {
    return (
      <section className="ficha-reproductor">
        <div className="ficha-sin-fuente">
          <Info aria-hidden="true" />
          <p>No se puede reproducir esta ficha</p>
          <span>
            Le falta el identificador de TMDB, que es lo que usan los servidores para encontrar
            el título.
          </span>
        </div>
      </section>
    );
  }

  return (
    // La key reinicia el componente —y con él el servidor elegido— al cambiar
    // de título o episodio, sin efectos que copien props a estado.
    <ReproductorCatalogo
      key={`${tmdbId}|${mediaType}|${temporada}|${episodio}`}
      titulo={titulo}
      tmdbId={tmdbId}
      mediaType={mediaType}
      temporada={temporada}
      episodio={episodio}
      spokenInSpanish={spokenInSpanish}
      enTelevisor={enTelevisor}
      servidoresIniciales={servidoresIniciales}
    />
  );
}

/**
 * El reproductor cuando el título viene del catálogo de TMDB.
 *
 * Mientras `/api/stream` responde se enseña ya el iframe del primer proveedor
 * que cubra el tipo, armado en el cliente con las mismas plantillas: la primera
 * imagen tarda lo mismo que antes. Cuando llega la lista, todos los servidores
 * quedan como botones y el activo por defecto es el primero (un embed,
 * instantáneo) — el mismo que ya se estaba viendo.
 */
function ReproductorCatalogo({
  titulo,
  tmdbId,
  mediaType,
  temporada,
  episodio,
  spokenInSpanish,
  enTelevisor,
  servidoresIniciales,
}: {
  titulo: string;
  tmdbId: number;
  mediaType: MediaType;
  temporada: number;
  episodio: number;
  spokenInSpanish: boolean;
  enTelevisor: boolean;
  servidoresIniciales?: ServidorStream[];
}) {
  const servidores = useServidores(
    tmdbId,
    titulo,
    mediaType,
    temporada,
    episodio,
    servidoresIniciales,
  );
  // La elección manual vive y muere con este componente: el padre lo monta con
  // una key distinta por título/episodio, así que aquí nunca llega una elección
  // vieja de otro capítulo.
  const [elegidoId, setElegidoId] = useState<string | null>(null);
  /**
   * Servidores descartados para esta ficha, por dos vías que se complementan:
   *
   * - **Automática**, cuando el marco se recarga solo sin parar
   *   (`marco-en-bucle.ts`). Solo ve las recargas del marco que montamos
   *   nosotros; las de un marco anidado dentro suyo son invisibles.
   * - **A mano**, cuando la persona dice que no se ve. Es la que cubre todo lo
   *   demás, que es mucho: dentro de un iframe de otro dominio no se puede
   *   saber si el vídeo arrancó, si el reproductor del proveedor dio error
   *   —«no se puede reproducir, 232011» y compañía— ni si la puerta antirrobot
   *   del proveedor está dando vueltas en un marco nieto. La persona lo ve en
   *   un segundo; el código, nunca.
   */
  const [descartados, setDescartados] = useState<string[]>([]);
  const cargas = useRef<ConteoDeCargas | null>(null);
  /**
   * Servidor para el que ya toca ofrecer el cambio.
   *
   * Se guarda el ID y no un booleano a propósito: así el efecto de abajo no
   * tiene que apagar nada al cambiar de servidor —lo que sería un `setState`
   * síncrono dentro de un efecto, con la cascada de renders que eso arrastra—.
   * Basta con comparar contra el activo.
   */
  const [avisarPara, setAvisarPara] = useState<string | null>(null);
  /**
   * Si el mando puede entrar dentro del vídeo del proveedor.
   *
   * Empieza en `false`, y ese es el detalle que quita los pop-ups. Los
   * popunder de estos servidores —vidlink carga AdCash y tiene un
   * `processPopunderQueue`— necesitan un **gesto de la persona DENTRO del
   * marco**: sin gesto, el navegador bloquea `window.open` él solo. Con un
   * mando no hay puntero, así que si el foco nunca cruza al iframe, no hay
   * clic dentro, y sin clic dentro no hay pestaña que se abra.
   *
   * No es una jaula: el botón de al lado se lo entrega cuando de verdad hace
   * falta —pausar, buscar, cambiar de calidad— y entonces sí es cosa suya.
   */
  const [marcoAbierto, setMarcoAbierto] = useState(false);
  const marcoRef = useRef<HTMLIFrameElement | null>(null);

  /**
   * Respaldo inmediato, mientras `/api/stream` responde y también si falla.
   *
   * Es **el primero de la lista que cubra este tipo**, que es exactamente el
   * que va a llegar como `servidores[0]`. Antes estaba fijado a VidSrc y en
   * películas eso significaba cargar un frame condenado: aparecía VidSrc, y
   * décimas después la lista lo sustituía por Vimeus: dos cargas y un
   * parpadeo, con el agravante de que VidSrc es justo el que no arranca en un
   * televisor.
   */
  const respaldo = useMemo<ServidorStream | null>(() => {
    // Si el servidor ya mandó la lista comprobada, no hay nada que adivinar:
    // su primero es un servidor que TIENE el título. Adivinar aquí es lo que
    // hacía que en una película sin Vimeus se viera su «Not Found» hasta que
    // respondiera `/api/stream`.
    if (servidoresIniciales && servidoresIniciales.length > 0) return servidoresIniciales[0];

    // Sin salidas anticipadas dentro del `useMemo`: el compilador de React no
    // sabe preservar la memoización de un `return` dentro de un bucle y el
    // lint lo rechaza. Con `map` + `find` es una expresión y sí la conserva.
    const lista = enTelevisor ? ordenarParaTelevisor(getProviders()) : getProviders();
    const candidatos = lista.map((provider) => ({
      provider,
      url: buildEmbedUrl(provider, mediaType, {
        tmdbId,
        season: temporada,
        episode: episodio,
      }),
    }));
    const primero = candidatos.find(
      (candidato): candidato is { provider: EmbedProvider; url: string } => candidato.url !== null
    );
    return primero
      ? {
          id: primero.provider.id,
          // «Servidor 1» y no la etiqueta que trae `getProviders()`: esa numera
          // sobre la lista COMPLETA, y en series —donde Vimeus no cubre— el
          // primero disponible se llamaría «Servidor 2». `/api/stream` ya
          // renumera después de filtrar; esto hace lo mismo para que el
          // respaldo no cante mientras llega.
          label: "Servidor 1",
          tipo: "embed",
          url: primero.url,
          puertaAntirrobot: primero.provider.puertaAntirrobot,
          subtitulos: primero.provider.spanishSubtitles,
        }
      : null;
  }, [mediaType, tmdbId, temporada, episodio, enTelevisor, servidoresIniciales]);

  // Elegido manual, si no el primero de la lista (un embed, instantáneo), y
  // como último recurso el respaldo de arriba. Memoizado para que la identidad
  // no cambie con cada render: de ella cuelga la lista que reinicia o no al
  // reproductor.
  const activo: ServidorStream | null = useMemo(() => {
    // Un servidor que se recarga en bucle no es una opción: se salta, aunque
    // sea el elegido a mano, porque ahí no se ve nada de todos modos.
    const sirve = (servidor: ServidorStream) => !descartados.includes(servidor.id);
    const utiles = servidores.filter(sirve);
    const elegido = utiles.find((servidor) => servidor.id === elegidoId);
    const deRespaldo = respaldo && sirve(respaldo) ? respaldo : null;
    return elegido ?? utiles[0] ?? deRespaldo;
  }, [elegidoId, servidores, respaldo, descartados]);

  /**
   * Cada vez que NUESTRO marco carga un documento.
   *
   * Sirve para el proveedor que se recarga a sí mismo: uno sano carga una vez,
   * uno en bucle dispara ocho veces en cinco segundos, y al pasarse se descarta
   * y `activo` salta al siguiente — lo que además apunta el `src` a otro sitio
   * y corta el bucle en seco.
   *
   * **Y solo para eso.** Si quien se recarga es un marco ANIDADO dentro del
   * nuestro —el caso de VidSrc, que esconde su puerta de Turnstile en un
   * iframe nieto— este evento no se dispara: medido, 14 navegaciones reales
   * frente a 1 evento visto. Esa clase de bucle se evita antes, ordenando los
   * proveedores —los de puerta antirrobot van los últimos, ver
   * `providers.ts`— y si aun así ocurre lo corta la persona con el botón de
   * abajo. Este contador no la sustituye.
   */
  const descartar = useCallback((servidorId: string) => {
    setDescartados((previos) =>
      previos.includes(servidorId) ? previos : [...previos, servidorId],
    );
  }, []);

  /**
   * El reloj de «esto no arranca».
   *
   * Se reinicia con cada servidor. No mide si el vídeo va —eso no se puede
   * saber desde fuera de un iframe ajeno—, solo cuánto lleva la persona
   * mirando. Pasado ese rato se le ofrece el cambio, que es lo único honesto
   * que se puede hacer: preguntar en vez de adivinar.
   */
  const servidorActivoId = activo?.id;

  /** Cada servidor empieza cerrado: cambiar de uno no hereda el permiso. */
  const [servidorDelPermiso, setServidorDelPermiso] = useState<string | null>(null);
  const abierto = marcoAbierto && servidorDelPermiso === servidorActivoId;

  const abrirMarco = useCallback(() => {
    if (!servidorActivoId) return;
    setServidorDelPermiso(servidorActivoId);
    setMarcoAbierto(true);
    // El foco se entrega en el mismo gesto: con un mando, si no se mueve solo,
    // la persona se queda pulsando flechas sin que pase nada.
    requestAnimationFrame(() => marcoRef.current?.focus());
  }, [servidorActivoId]);

  useEffect(() => {
    if (!servidorActivoId) return;
    const reloj = setTimeout(
      () => setAvisarPara(servidorActivoId),
      activo?.puertaAntirrobot ? ESPERA_CON_PUERTA_MS : ESPERA_ANTES_DE_OFRECER_MS,
    );
    return () => clearTimeout(reloj);
  }, [servidorActivoId, activo?.puertaAntirrobot]);

  const ofrecerCambio = avisarPara === servidorActivoId;

  const alCargarMarco = useCallback(() => {
    const servidorId = activo?.id;
    if (!servidorId) return;
    const veredicto = registrarCarga(cargas.current, servidorId, Date.now());
    cargas.current = veredicto.conteo;
    if (veredicto.enBucle) descartar(servidorId);
  }, [activo?.id, descartar]);

  /**
   * La lista de streams debe conservar la identidad entre renders. El
   * reproductor rearranca la emisión cuando cambia el objeto `stream` que
   * recibe; recrear el array inline en cada render —cuando llega la lista de
   * servidores, al elegir otro, con cualquier parpadeo— reiniciaba el vídeo
   * desde cero: el «se repite el reproductor» reportado en televisores.
   */
  const streamDirecto = useMemo<ManualStream[]>(
    () => (activo ? [{ label: titulo, url: activo.url, type: "auto" }] : []),
    [titulo, activo],
  );

  // Todos los servidores se quedaron en bucle: decirlo, en vez de dejar una
  // rueda girando para siempre como hacía antes.
  if (!activo && descartados.length > 0) {
    return (
      <section className="ficha-reproductor">
        <div className="ficha-sin-fuente">
          <Info aria-hidden="true" />
          <p>Ningún servidor llegó a cargar</p>
          <span>
            Se probaron todos. En el navegador de un televisor es lo habitual cuando sus
            comprobaciones antirrobot no pasan. Prueba desde el teléfono, o usa «Mi enlace»
            con un enlace propio.
          </span>
        </div>
      </section>
    );
  }

  if (!activo) {
    return (
      <section className="ficha-reproductor">
        <div className="player-surface ficha-marco is-cargando" />
      </section>
    );
  }

  return (
    <section className="ficha-reproductor">
      <div className="ficha-conjunto">
        <div className="player-surface ficha-marco">
          {activo.tipo === "video" ? (
            /* Enlace directo (.mp4/.m3u8) de un addon: reproductor HTML5
               propio con hls.js — la única vía sin anuncios. */
            <NativePlayer streams={streamDirecto} title={titulo} />
          ) : (
            /* Sin `sandbox`. Se puso para que los guiones de publicidad no
               pudieran navegar la ventana entera, y no cumplió: el bucle de
               recargas que perseguía vive en un marco anidado y se recarga a
               sí mismo, cosa que el sandbox no impide. Lo único que consiguió
               fue que los proveedores lo detectaran y se negaran a reproducir
               («iframe sandbox detected»). Se retira entero. */
            <iframe
              // Un marco nuevo por servidor: cambiar solo el `src` deja dentro
              // el historial del anterior, y con él su bucle de recargas.
              key={activo.id}
              ref={marcoRef}
              src={activo.url}
              title={titulo}
              onLoad={alCargarMarco}
              /* Con `-1` el mando no puede entrar aquí, y eso es lo que corta
                 los pop-ups: sin gesto dentro del marco, el navegador ya
                 bloquea `window.open` por su cuenta. Ver `marcoAbierto`. */
              tabIndex={abierto ? 0 : -1}
              allowFullScreen
              allow="autoplay; encrypted-media; fullscreen"
              referrerPolicy="origin"
            />
          )}
        </div>

        {/* Acciones, no lecciones.

            Aquí se explicaba en un párrafo qué proveedor traía subtítulos y
            cuál se recargaba en los televisores. Era información verdadera y
            en el sitio equivocado: quien está mirando una pantalla que no
            arranca no quiere leer sobre servidores, quiere pasar al siguiente.
            Los subtítulos ya se ven donde toca —la insignia de cada botón del
            selector de abajo— y aquí solo quedan los mandos.

            **«Probar otro servidor» se queda, y es necesario.** La
            comprobación del servidor (`disponibilidad.ts`) solo cubre «no
            tengo ese título». Los otros fallos —que lo tenga pero su
            reproductor dé error, o que su puerta antirrobot dé vueltas en un
            marco nieto— siguen sin poder verse desde fuera de un iframe ajeno
            (medido: 14 navegaciones reales, 1 evento `load`). Es lo único que
            cubre TODOS los modos de fallo, incluidos los que aún no
            conocemos.

            UNA sola barra al pie del vídeo, no dos apiladas: en un televisor
            cada barra empuja hacia abajo lo de después, y la salida acababa
            fuera de pantalla. */}
        {/* Sin nada que decir ni que ofrecer, la barra no existe: antes había
            siempre un texto de relleno para que no quedara una caja vacía, y
            la respuesta correcta es no pintar la caja. */}
        {(descartados.length > 0 || (ofrecerCambio && activo) || !abierto) && (
        <div className="ficha-aviso" role="status">
          {descartados.length > 0 && (
            <span>
              Se {descartados.length === 1 ? "saltó" : "saltaron"} {descartados.length}{" "}
              servidor{descartados.length === 1 ? "" : "es"}.
            </span>
          )}

          {/* La salida primero: cuando hace falta, es lo que se busca. */}
          {ofrecerCambio && activo && (
            <button
              type="button"
              data-nav="button"
              className="ficha-aviso-accion"
              onClick={() => descartar(activo.id)}
            >
              Probar otro servidor
            </button>
          )}

          {/* Entregar el mando al reproductor ajeno, a propósito. Mientras no
              se pulse, el foco no entra en el marco y sus popunder se quedan
              sin el gesto que necesitan para abrir pestañas. */}
          {!abierto && (
            <button
              type="button"
              data-nav="button"
              className="ficha-aviso-accion is-suave"
              onClick={abrirMarco}
            >
              Usar los controles del servidor
            </button>
          )}
        </div>
        )}

        {/* Al pie del vídeo, no suelto en la página: es un control de este
            reproductor, y cuando la imagen no se ve la mano ya está ahí. */}
        <ServerPicker
          providers={servidores.map((servidor) => ({
            id: servidor.id,
            label: servidor.label,
            subtitulos: servidor.subtitulos,
          }))}
          activeId={activo.id}
          onSelect={setElegidoId}
          nota={
            /* Se distingue lo que se sabe con certeza (se rodó en español) de
               lo que solo se puede pedir (subtítulos del embed), para no
               prometer pistas que quizá no existan. */
            spokenInSpanish ? (
              <span className="ficha-marca is-si">Hablada en español</span>
            ) : (
              <span className="ficha-marca is-quiza">Subtítulos en español</span>
            )
          }
        />
      </div>
    </section>
  );
}

/**
 * Pide a `/api/stream` los servidores del título: una sola llamada, respuesta
 * inmediata con la lista completa de embeds.
 */
function useServidores(
  tmdbId: number,
  titulo: string,
  mediaType: MediaType,
  temporada: number,
  episodio: number,
  /** Lo que ya calculó el servidor: se parte de ahí en vez de de una lista vacía. */
  iniciales: ServidorStream[] = [],
): ServidorStream[] {
  const [servidores, setServidores] = useState<ServidorStream[]>(iniciales);

  useEffect(() => {
    // Cada parámetro por separado: son primitivos y el efecto solo se repite
    // cuando cambia de verdad el título o el episodio pedido.
    const controlador = new AbortController();
    const params = new URLSearchParams({
      tmdbId: String(tmdbId),
      title: titulo,
      type: mediaType,
      season: String(temporada),
      episode: String(episodio),
    });
    fetch(`/api/stream?${params}`, { signal: controlador.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<RespuestaStream>;
      })
      .then((data) =>
        setServidores(
          (data.servidores ?? []).filter(
            (servidor) => typeof servidor.url === "string" && /^https?:\/\//i.test(servidor.url)
          )
        )
      )
      .catch(() => {
        /* Abortado o la ruta falló: se queda el fallback de VidSrc. */
      });

    return () => controlador.abort();
  }, [tmdbId, titulo, mediaType, temporada, episodio]);

  return servidores;
}
