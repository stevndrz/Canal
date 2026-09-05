"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import { claveDeTitulo } from "@/lib/progreso";

/**
 * Cuánto se espera antes de ofrecer el cambio de servidor.
 *
 * Suficiente para que un embed lento arranque —una tele vieja tarda—, poco
 * para no dejar a nadie mirando una rueda sin saber que hay salida.
 */
const ESPERA_ANTES_DE_OFRECER_MS = 12_000;

/**
 * Lo mismo, para los proveedores con puerta antirrobot. Cuatro segundos: de
 * esos ya se sabe cómo fallan, así que se baja a lo justo para no cortarle el
 * arranque a una tele lenta. Esperar doce a algo que no va a pasar es lo que
 * se sentía como «se queda cargando».
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
        <NativePlayer
          streams={fuente.streams}
          title={titulo}
          claveProgreso={
            tmdbId ? claveDeTitulo(mediaType, tmdbId, temporada, episodio) : undefined
          }
        />
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
 * El reproductor cuando el título viene de TMDB.
 *
 * Mientras `/api/stream` responde ya se enseña el iframe del primer proveedor
 * que cubra el tipo, armado en el cliente con las mismas plantillas. Cuando
 * llega la lista, el activo por defecto es ese mismo, así que no parpadea.
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
   * Servidores descartados para esta ficha, por dos vías:
   *
   * - **Automática**, cuando NUESTRO marco se recarga sin parar
   *   (`marco-en-bucle.ts`); las recargas de un marco anidado son invisibles.
   * - **A mano**, cuando la persona dice que no se ve. Cubre todo lo demás,
   *   que es mucho: desde fuera de un iframe ajeno no se sabe si el vídeo
   *   arrancó ni si el proveedor dio error. La persona lo ve en un segundo;
   *   el código, nunca.
   */
  const [descartados, setDescartados] = useState<Set<string>>(new Set());
  const cargas = useRef<ConteoDeCargas | null>(null);
  /**
   * Servidor para el que ya toca ofrecer el cambio. Se guarda el ID y no un
   * booleano: así al cambiar de servidor no hay que apagar nada —un `setState`
   * dentro de un efecto y su cascada—, basta comparar contra el activo.
   */
  const [avisarPara, setAvisarPara] = useState<string | null>(null);
  /**
   * Si el mando puede entrar dentro del vídeo del proveedor. Empieza en
   * `false`, y ese es el detalle que quita los pop-ups: los popunder necesitan
   * un **gesto DENTRO del marco** o el navegador bloquea `window.open` él
   * solo. Sin foco cruzado no hay clic dentro, y sin clic no hay pestaña.
   *
   * No es una jaula: el botón de al lado se lo entrega cuando hace falta.
   */
  const [marcoAbierto, setMarcoAbierto] = useState(false);
  const marcoRef = useRef<HTMLIFrameElement | null>(null);

  /**
   * Respaldo inmediato mientras `/api/stream` responde, y si falla. Es **el
   * primero de la lista que cubra este tipo**, o sea el que llegará como
   * `servidores[0]`. Fijado a VidSrc eran dos cargas y un parpadeo, y encima
   * VidSrc es justo el que no arranca en un televisor.
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
    const sirve = (servidor: ServidorStream) => !descartados.has(servidor.id);
    const utiles = servidores.filter(sirve);
    const elegido = utiles.find((servidor) => servidor.id === elegidoId);
    const deRespaldo = respaldo && sirve(respaldo) ? respaldo : null;
    return elegido ?? utiles[0] ?? deRespaldo;
  }, [elegidoId, servidores, respaldo, descartados]);

  /**
   * Cada vez que NUESTRO marco carga un documento. Sirve para el proveedor que
   * se recarga a sí mismo: uno sano carga una vez, uno en bucle ocho veces en
   * cinco segundos, y al pasarse se descarta y `activo` salta al siguiente, lo
   * que corta el bucle en seco.
   *
   * **Y solo para eso**: si quien se recarga es un marco ANIDADO —VidSrc y su
   * puerta de Turnstile— esto no se dispara (medido: 14 navegaciones, 1
   * evento). Ese caso se evita ordenando los proveedores, y si aun así pasa lo
   * corta la persona con el botón de abajo.
   */
  const descartar = useCallback((servidorId: string) => {
    setDescartados((previos) =>
      previos.has(servidorId) ? previos : new Set(previos).add(servidorId),
    );
  }, []);

  /**
   * El reloj de «esto no arranca». No mide si el vídeo va —desde fuera de un
   * iframe ajeno no se puede—, solo cuánto lleva mirando la persona. Pasado
   * ese rato se le ofrece el cambio: preguntar en vez de adivinar.
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
  /** Si el aviso tiene algo que decir u ofrecer; si no, ni se monta. */
  const mostrarAviso = descartados.size > 0 || (ofrecerCambio && !!activo) || !abierto;

  const alCargarMarco = useCallback(() => {
    const servidorId = activo?.id;
    if (!servidorId) return;
    const veredicto = registrarCarga(cargas.current, servidorId, Date.now());
    cargas.current = veredicto.conteo;
    if (veredicto.enBucle) descartar(servidorId);
  }, [activo?.id, descartar]);

  /**
   * Lo que va al `src` del iframe. Hoy coincide siempre con `url` — el proxy
   * de Vimeus que reescribía este campo está desconectado, ver
   * `buildIframeUrl` en `lib/catalog/providers.ts` para el porqué.
   */
  const urlIframe = activo?.urlEmbed ?? activo?.url ?? "";

  /**
   * Descargar el marco al ocultarse.
   *
   * `cacheComponents` (ver `next.config.ts`) no desmonta esta ficha al pasar
   * a Canales: la oculta con `<Activity>`, `display:none` conservando el DOM.
   * Un `<video>` propio se pausa (ver `native-player.tsx`), pero un iframe de
   * otro dominio no se puede ni pausar ni silenciar por JS — la única forma
   * de que el vídeo del proveedor deje de sonar de fondo es vaciarle el
   * `src`. Sin esto, la película embebida seguía reproduciéndose oculta
   * mientras el canal ya sonaba encima: el «duplicado» al cambiar de sección.
   *
   * Al volver a mostrarse, el efecto corre de nuevo — `<Activity>` repite el
   * ciclo de montaje en cada aparición, no solo la primera vez — y repone la
   * URL: el proveedor recarga desde cero, que es peor que retomar donde iba
   * pero mejor que dos audios a la vez. La comparación evita recargarlo en el
   * primer montaje, cuando el JSX ya dejó puesto el mismo `src`.
   */
  useLayoutEffect(() => {
    const marco = marcoRef.current;
    if (!marco || !urlIframe) return;
    if (marco.getAttribute("src") !== urlIframe) marco.src = urlIframe;
    return () => {
      marco.src = "about:blank";
    };
  }, [urlIframe]);

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
  if (!activo && descartados.size > 0) {
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
               propio con hls.js — la única vía sin anuncios.

               Y la única rama de esta pantalla donde se puede recordar por
               dónde iba: el `<video>` es nuestro. En la otra el reproductor es
               de otro dominio y su tiempo no se puede leer, así que ahí no se
               guarda nada en vez de guardar un cero que mentiría. */
            <NativePlayer
              streams={streamDirecto}
              title={titulo}
              claveProgreso={claveDeTitulo(mediaType, tmdbId, temporada, episodio)}
            />
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
              src={urlIframe}
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

            UN solo bloque al pie del vídeo, no dos barras apiladas cada una
            con su propio borde y relleno: eso era lo que hacía que, con más
            de un servidor, el pie del reproductor pesara tanto como el vídeo
            mismo. Aviso y selector comparten aquí un único borde y un único
            padding; cada uno por dentro es solo una fila. */}
        {/* Sin nada que decir ni que ofrecer, el bloque no existe: antes había
            siempre un texto de relleno para que no quedara una caja vacía, y
            la respuesta correcta es no pintar la caja. */}
        {(mostrarAviso || servidores.length > 1) && (
        <div className="ficha-controles">
          {mostrarAviso && (
          <div className="ficha-aviso" role="status">
            {descartados.size > 0 && (
              <span>
                Se {descartados.size === 1 ? "saltó" : "saltaron"} {descartados.size}{" "}
                servidor{descartados.size === 1 ? "" : "es"}.
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

            {/* Entregar el mando al reproductor ajeno, a propósito. Mientras
                no se pulse, el foco no entra en el marco y sus popunder se
                quedan sin el gesto que necesitan para abrir pestañas. Un
                enlace discreto y no un botón grande: en ratón casi nunca
                hace falta —el clic sobre el vídeo ya entra en el marco—,
                así que no necesita el mismo peso que «Probar otro servidor». */}
            {!abierto && (
              <button
                type="button"
                data-nav="button"
                className="ficha-aviso-accion is-suave"
                onClick={() => abrirMarco()}
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
        )}
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
