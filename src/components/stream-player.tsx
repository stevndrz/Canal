"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Play, RefreshCw, Radio } from "lucide-react";
import {
  claseDeEmision,
  fijarCalidad,
  montarMotor,
  resolverCalidad,
  type MotorMontado,
} from "@/lib/reproduccion/motor";
import { marcarInicio, registrarArranque, registrarAtasco, registrarFallo } from "@/lib/reproduccion/metricas";
import { ESPERA_SIN_IMAGEN_MS } from "@/lib/zapeo-automatico";
import type { Channel, PlaybackSettings } from "@/lib/types";
import { DEFAULT_PLAYBACK } from "@/lib/types";

/**
 * ⚠️ La selección de motor y el ciclo de vida de hls.js / mpegts.js son los
 * del proyecto original, sin cambios de comportamiento. Lo único nuevo:
 * - la superficie es un <video> pelado (el chrome lo dibuja quien lo monta),
 * - los flags de Ajustes entran por props,
 * - se expone un handle imperativo para que los controles vivan fuera.
 */

export interface StreamPlayerHandle {
  togglePlay: () => void;
  toggleMute: () => void;
  retry: () => void;
  requestFullscreen: () => void;
  video: () => HTMLVideoElement | null;
}

export interface StreamPlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  streamError: boolean;
  needsUserGesture: boolean;
  /**
   * Lo que se está reproduciendo de verdad, para el chrome de sala de control.
   *
   * **Nada de esto se inventa ni se estima.** La resolución sale del propio
   * `<video>`, así que vale con hls.js, con mpegts.js y con el HLS nativo de
   * Safari por igual. El bitrate solo lo sabe hls.js: cuando manda otro motor
   * el campo no existe, y quien lo pinta no enseña el módulo en vez de sacar
   * un hueco vacío.
   */
  ancho?: number;
  alto?: number;
  /** Bits por segundo de la pista activa. Solo con hls.js. */
  bitrate?: number;
  /** Se quedó sin búfer a mitad de emisión (eventos `waiting`). */
  buffering?: boolean;
  /** Cortes acumulados desde que se sintonizó. */
  stalls?: number;
  /** Fotogramas perdidos que reporta el propio `<video>`. */
  dropped?: number;
  /** Tiempo hasta el primer fotograma, en ms. */
  ttffMs?: number;
}

interface StreamPlayerProps {
  channel: Channel;
  settings?: PlaybackSettings;
  /** El padre refleja play/mute/error en su propio chrome. */
  onStateChange?: (state: StreamPlayerState) => void;
  className?: string;
}

/**
 * Devolver el sonido a un vídeo que arrancó en silencio. No hay forma limpia de
 * preguntar «¿puedo sonar?», así que hay dos vías:
 *
 * - Donde existe `navigator.userActivation` (Chromium 72+), se pregunta si la
 *   persona ya ha tocado algo. Si lo ha hecho, quitar el silencio es seguro.
 * - Donde no —Tizen 4 y 5 son Chromium 56 y 69, y son la mitad del parque—,
 *   se prueba y se comprueba: si el navegador no lo permitía, **pausa el
 *   vídeo**. Entonces se vuelve a silenciar y se reanuda. Perder el sonido un
 *   instante es asumible; quedarse sin imagen, no.
 */
function recuperarSonido(
  video: HTMLVideoElement,
  quiereSonido: boolean,
  vivo: () => boolean,
  setIsMuted: (mudo: boolean) => void,
): void {
  if (!quiereSonido || !video.muted) return;

  const activacion = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
    .userActivation;
  if (activacion && !activacion.hasBeenActive) return;

  video.muted = false;
  setIsMuted(false);
  if (activacion) return;

  window.setTimeout(() => {
    if (!vivo() || !video.paused) return;
    video.muted = true;
    setIsMuted(true);
    void video.play().catch(() => {});
  }, 400);
}

const StreamPlayer = memo(
  forwardRef<StreamPlayerHandle, StreamPlayerProps>(function StreamPlayer(
    { channel, settings = DEFAULT_PLAYBACK, onStateChange, className = "" },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    // Los tipos salen de `MotorMontado` en lugar de importar hls.js y
    // mpegts.js aquí: son los mismos, y así este archivo deja de nombrar las
    // librerías que ya no usa directamente.
    const hlsRef = useRef<MotorMontado["hls"]>(null);
    const mpegtsRef = useRef<MotorMontado["mpegts"]>(null);
    /**
     * Estado de telemetría del canal en curso. Fuera de React porque no pinta
     * nada: son marcas de tiempo para un evento que se manda una vez y se
     * olvida, no datos que el chrome del reproductor necesite leer.
     */
    const inicioSintonia = useRef(0);
    const arranqueAvisado = useRef(false);
    const yaArrancoEmision = useRef(false);
    const atascoDesde = useRef<number | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [streamError, setStreamError] = useState(false);
    const [needsUserGesture, setNeedsUserGesture] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    /**
     * Entre pulsar un canal y el primer fotograma no había nada: negro, sin
     * pista de si el mando hizo caso. Con 7.822 canales, muchos lentos o
     * muertos, eso es la diferencia entre esperar y pulsar OK cuatro veces.
     */
    const [sintonizando, setSintonizando] = useState(true);
    /**
     * Lo que se reproduce de verdad (ver `StreamPlayerState`). Junto y no en
     * tres estados sueltos porque llega junto, y tres `setState` seguidos
     * serían tres renders para pintar una línea de texto.
     */
    const [emision, setEmision] = useState<{
      ancho?: number;
      alto?: number;
      bitrate?: number;
      buffering?: boolean;
      stalls?: number;
      dropped?: number;
      ttffMs?: number;
    }>({});

    const streamUrl = channel.streamUrl;
    const respaldoUrl = channel.streamUrlBackup;
    /**
     * Cuando la fuente principal declara el fallo y hay respaldo, se prueba la
     * segunda URL antes de enseñar «Sin señal». Una sola vez por canal: si el
     * respaldo también falla, el error ya es de verdad.
     */
    const [usandoRespaldo, setUsandoRespaldo] = useState(false);
    useEffect(() => {
      setUsandoRespaldo(false);
    }, [channel.id, streamUrl]);
    const usandoRespaldoRef = useRef(false);
    useEffect(() => {
      usandoRespaldoRef.current = usandoRespaldo;
    }, [usandoRespaldo]);
    useEffect(() => {
      usandoRespaldoRef.current = false;
    }, [channel.id, streamUrl]);
    const urlEfectiva = usandoRespaldo && respaldoUrl ? respaldoUrl : streamUrl;

    /**
     * Pausa síncrona al ocultarse. Mismo motivo que en `native-player.tsx`:
     * `cacheComponents` oculta la vista en vez de desmontarla (`<Activity>`,
     * `display:none`), y eso no para un `<video>`. Sin esto, al abrir una
     * ficha desde Canales, el canal seguía sonando de fondo mientras la
     * película ya arrancaba encima. La limpieza completa (destruir hls/mpegts,
     * soltar el `src`) se queda en el efecto de abajo; aquí solo se adelanta
     * lo que sí tiene que ser inmediato: que deje de sonar.
     */
    useLayoutEffect(() => {
      const video = videoRef.current;
      return () => {
        video?.pause();
      };
    }, []);

    /**
     * «Arrancar con sonido» es una preferencia de ARRANQUE, y se lee por `ref`.
     *
     * Estando en las dependencias del efecto que monta el motor, **pulsar
     * silencio rearrancaba el canal entero**: el botón escribe `startUnmuted`,
     * cambiaba la dependencia, el efecto se remontaba y salía «Sintonizando
     * Canal 3…» unos segundos. Lo más barato que se le puede pedir a un
     * reproductor costaba una reconexión.
     *
     * Con la `ref` el efecto no depende del valor pero lee el actual en el
     * primer `play()`, la única vez que este ajuste significa algo.
     */
    const quiereSonido = useRef(settings.startUnmuted);
    useEffect(() => {
      quiereSonido.current = settings.startUnmuted;
    }, [settings.startUnmuted]);

    /**
     * La calidad de ARRANQUE se lee por `ref`, como el sonido: `startLevel` y
     * `capLevelToPlayerSize` solo se leen al construir hls.js, y con el valor
     * en las dependencias del efecto cambiar de escalón cortaría y rearrancaría
     * la emisión. Los cambios en caliente los aplica `fijarCalidad` abajo.
     */
    const calidadArranque = useRef(resolverCalidad(settings.calidad, settings.calidadMaxima));
    useEffect(() => {
      calidadArranque.current = resolverCalidad(settings.calidad, settings.calidadMaxima);
    }, [settings.calidad, settings.calidadMaxima]);

    const handleRetry = useCallback(() => {
      setUsandoRespaldo(false);
      usandoRespaldoRef.current = false;
      setRetryCount((n) => n + 1);
    }, []);

    /**
     * El aviso al padre, **sin que el padre pueda provocar un bucle**.
     *
     * Con `onStateChange` en las dependencias del efecto de abajo, un padre que
     * pasara una función en línea —lo que hacía `live-card.tsx`— cerraba el
     * ciclo: render del padre → función nueva → falla `memo` → cambian las
     * dependencias → el efecto avisa con un objeto nuevo → `setState` en el
     * padre → vuelta a empezar.
     *
     * Cada vuelta es barata, así que nada se congela ni avisa: solo programa
     * trabajo sin parar en la cola normal, que va por encima de la de
     * transiciones. Medido: con vídeo montado, un `<Link>` **no llegaba a
     * confirmarse nunca**; se quedaba encolado hasta que un clic discreto
     * forzaba el vaciado, y entonces te llevaba a la página equivocada.
     *
     * Con el callback en una `ref` el efecto solo corre cuando cambia el vídeo,
     * y ningún consumidor puede volver a abrir el ciclo.
     */
    const avisar = useRef(onStateChange);
    useEffect(() => {
      avisar.current = onStateChange;
    });

    useEffect(() => {
      avisar.current?.({ isPlaying, isMuted, streamError, needsUserGesture, ...emision });
    }, [isPlaying, isMuted, streamError, needsUserGesture, emision]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      let cancelled = false;
      const inicio = typeof performance !== "undefined" ? performance.now() : Date.now();
      setStreamError(false);
      setNeedsUserGesture(false);
      setSintonizando(true);
      inicioSintonia.current = marcarInicio();
      arranqueAvisado.current = false;
      yaArrancoEmision.current = false;
      atascoDesde.current = null;
      // La emisión anterior no dice nada de la nueva: dejar puesta su
      // resolución enseñaría 1080p mientras arranca un canal que es 480p.
      setEmision({});
      /**
       * **Se arranca SIEMPRE en silencio**: es lo único que todos los
       * navegadores permiten sin un gesto previo. Intentarlo con sonido acaba
       * en un cartel de «Activar sonido» tapando el vídeo, y quien abre una app
       * de televisión quiere imagen, no un aviso. El sonido lo recupera
       * `recuperarSonido` en cuanto se puede, o el botón de la barra.
       */
      video.muted = true;
      setIsMuted(true);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (mpegtsRef.current) {
        mpegtsRef.current.destroy();
        mpegtsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();

      const tryPlay = () => {
        if (cancelled) return;
        video
          .play()
          .then(() => {
            if (cancelled) return;
            setIsPlaying(true);
            recuperarSonido(video, quiereSonido.current, () => !cancelled, setIsMuted);
          })
          .catch(() => {
            // Ni en silencio se puede: ahí sí no hay nada que enseñar, y el
            // cartel es lo único que queda. Es el caso raro, no el de siempre.
            if (cancelled) return;
            setNeedsUserGesture(true);
            setIsPlaying(false);
          });
      };

      const handleFatalError = () => {
        if (cancelled) return;
        // Con respaldo sin probar, se cambia de fuente en silencio en vez de
        // declarar la señal caída: el efecto se vuelve a montar con la otra URL.
        if (respaldoUrl && !usandoRespaldoRef.current) {
          usandoRespaldoRef.current = true;
          setUsandoRespaldo(true);
          return;
        }
        setStreamError(true);
        registrarFallo(clase, "canal");
      };

      const clase =
        settings.engine === "hls"
          ? "hls"
          : settings.engine === "mpegts"
            ? "mpegts"
            : claseDeEmision(urlEfectiva);

      // El motor se monta aparte: qué librería reproduce cada enlace es una
      // decisión propia, no parte del ciclo de vida de este componente.
      void montarMotor({
        video,
        url: urlEfectiva,
        clase,
        // Solo lo que el motor usa, y campo a campo: así las dependencias del
        // efecto siguen siendo granulares y cambiar un ajuste que no le
        // incumbe no reinicia la emisión.
        settings: {
          enableWorker: settings.enableWorker,
          lowLatencyMode: settings.lowLatencyMode,
          liveBufferLatencyChasing: settings.liveBufferLatencyChasing,
          // Ya resuelta arriba (incluye la migración del ajuste viejo): se pasa
          // cerrada para que el efecto no dependa de los dos campos.
          calidadMaxima: false,
          calidad: calidadArranque.current,
        },
        cancelado: () => cancelled,
        alPoderReproducir: tryPlay,
        alFallar: handleFatalError,
      }).then((motor) => {
        // Si se cambió de canal mientras se cargaba la librería, lo que acaba
        // de montarse ya no sirve: se destruye aquí mismo en vez de guardarlo
        // en el ref, donde pelearía con el motor del canal nuevo.
        if (cancelled) {
          motor.hls?.destroy();
          motor.mpegts?.destroy();
          return;
        }
        hlsRef.current = motor.hls;
        mpegtsRef.current = motor.mpegts;

        /**
         * El bitrate solo lo sabe hls.js. Con mpegts.js o el HLS nativo de
         * Safari el campo se queda sin poner y quien lo pinta esconde el
         * módulo: antes ningún dato que uno inventado.
         *
         * Lectura defensiva: `levels` y `currentLevel` no están en el tipo
         * público, y una versión vieja podría no traerlos.
         */
        const hls = motor.hls as unknown as {
          levels?: { bitrate?: number }[];
          currentLevel?: number;
          on?: (evento: string, manejador: () => void) => void;
        } | null;
        if (!hls?.on) return;

        const leerBitrate = () => {
          if (cancelled) return;
          const nivel = hls.levels?.[hls.currentLevel ?? -1];
          if (nivel?.bitrate) setEmision((actual) => ({ ...actual, bitrate: nivel.bitrate }));
        };
        // `hlsLevelSwitched` es el nombre del evento en el bus de hls.js.
        hls.on("hlsLevelSwitched", leerBitrate);
        leerBitrate();
      });

      const handleNativeError = () => handleFatalError();
      video.addEventListener("error", handleNativeError);

      /**
       * El aviso se quita con **imagen**, no con datos. `playing` es el que
       * significa «se ve algo»; `loadeddata` va detrás porque hay teles que no
       * disparan el primero al arrancar en silencio. Basta con que llegue uno.
       */
      const leerCaidos = () => {
        try {
          const calidad = video.getVideoPlaybackQuality?.();
          return calidad?.droppedVideoFrames && calidad.droppedVideoFrames > 0
            ? calidad.droppedVideoFrames
            : undefined;
        } catch {
          return undefined;
        }
      };
      const yaSeVe = () => {
        const ahora = typeof performance !== "undefined" ? performance.now() : Date.now();
        const ttffMs = Math.max(0, Math.round(ahora - inicio));
        setSintonizando(false);
        // Si al final hay imagen, el cartel de «no se pudo reproducir» ya no
        // es verdad: antes se quedaba puesto tapando un vídeo que iba bien.
        setNeedsUserGesture(false);
        setEmision((actual) =>
          actual.ttffMs !== undefined
            ? actual
            : { ...actual, buffering: false, ttffMs, dropped: leerCaidos() },
        );
        if (!arranqueAvisado.current) {
          arranqueAvisado.current = true;
          registrarArranque(inicioSintonia.current, clase, "canal");
        }
        yaArrancoEmision.current = true;
      };

      /**
       * Cortes a mitad de emisión: `waiting`/`stalled` es «sin búfer» y
       * `playing` es «ya hay de nuevo». Se cuentan aparte del arranque (ese lo
       * mide el TTFF) y viajan en `emision.stalls` hasta el panel.
       *
       * El atasco de telemetría (`atascoDesde`/`registrarAtasco`) es aparte y
       * solo cuenta DESPUÉS de haberse visto ya el primer fotograma: el
       * `waiting` de antes de `yaSeVe` es el arranque normal, no un corte, y
       * contarlo ahí ensuciaría el promedio con lo que ya mide `registrarArranque`.
       */
      const alEsperar = () => {
        if (cancelled) return;
        setEmision((actual) => ({
          ...actual,
          buffering: true,
          stalls: (actual.stalls ?? 0) + 1,
        }));
        if (!yaArrancoEmision.current || atascoDesde.current !== null) return;
        atascoDesde.current = marcarInicio();
      };
      const alSeguir = () => {
        if (cancelled) return;
        setEmision((actual) =>
          actual.buffering ? { ...actual, buffering: false, dropped: leerCaidos() ?? actual.dropped } : actual,
        );
        if (atascoDesde.current === null) return;
        registrarAtasco(atascoDesde.current, clase, "canal");
        atascoDesde.current = null;
      };

      /**
       * La resolución real, del propio `<video>`.
       *
       * `videoWidth`/`videoHeight` es lo que el elemento está decodificando de
       * verdad, así que vale igual con hls.js, con mpegts.js y con el HLS
       * nativo de Safari — no hace falta preguntarle a ninguna librería. El
       * evento `resize` es justo cuando cambia, que en una emisión adaptativa
       * pasa cada vez que sube o baja de pista.
       */
      const medirImagen = () => {
        if (cancelled || !video.videoWidth) return;
        setEmision((actual) =>
          actual.ancho === video.videoWidth && actual.alto === video.videoHeight
            ? actual
            : { ...actual, ancho: video.videoWidth, alto: video.videoHeight },
        );
      };
      /**
       * El canal que acepta la conexión y luego no manda nada.
       *
       * Es **el modo de fallo más común de una lista IPTV pública**, y era el
       * único que esta pantalla no sabía ver: sin error del motor no había
       * nada que declarar, así que la ruedita giraba indefinidamente, el canal
       * nunca se apuntaba como caído y el respaldo de la segunda URL —que ya
       * estaba escrito— no llegaba a probarse. Solo se salía de ahí eligiendo
       * otro canal a mano.
       *
       * Pasado el plazo sin un solo fotograma, se trata igual que un error
       * fatal: primero la otra URL del mismo canal, y si tampoco, «Sin señal».
       * Ver `ESPERA_SIN_IMAGEN_MS` para el porqué del número.
       */
      const sinImagen = window.setTimeout(() => {
        if (cancelled || yaArrancoEmision.current) return;
        handleFatalError();
      }, ESPERA_SIN_IMAGEN_MS);

      video.addEventListener("resize", medirImagen);
      video.addEventListener("loadedmetadata", medirImagen);
      video.addEventListener("playing", yaSeVe);
      video.addEventListener("loadeddata", yaSeVe);
      video.addEventListener("waiting", alEsperar);
      video.addEventListener("playing", alSeguir);
      video.addEventListener("stalled", alEsperar);

      return () => {
        cancelled = true;
        window.clearTimeout(sinImagen);
        video.removeEventListener("error", handleNativeError);
        video.removeEventListener("playing", yaSeVe);
        video.removeEventListener("loadeddata", yaSeVe);
        video.removeEventListener("waiting", alEsperar);
        video.removeEventListener("playing", alSeguir);
        video.removeEventListener("stalled", alEsperar);
        video.removeEventListener("resize", medirImagen);
        video.removeEventListener("loadedmetadata", medirImagen);
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        if (mpegtsRef.current) {
          mpegtsRef.current.destroy();
          mpegtsRef.current = null;
        }
        video.pause();
        video.removeAttribute("src");
        video.load();
      };
       
    }, [
      channel.id,
      streamUrl,
      respaldoUrl,
      urlEfectiva,
      usandoRespaldo,
      retryCount,
      settings.engine,
      settings.enableWorker,
      settings.lowLatencyMode,
      settings.liveBufferLatencyChasing,
      // `settings.startUnmuted` NO va aquí a propósito: se lee por `ref` arriba.
      // Con él en la lista, pulsar el botón de silencio rearrancaba el canal.
      // `settings.calidad` / `calidadMaxima` TAMPOCO: van por `calidadArranque`
      // al montar y en caliente con `fijarCalidad` abajo, sin cortar la emisión.
    ]);

    /**
     * Cambiar de escalón sin cortar la emisión.
     *
     * El efecto de arriba solo usa la calidad al construir hls.js (`startLevel`
     * no se puede cambiar después); una vez en marcha, limitar el nivel máximo
     * basta y el ABR sigue trabajando por debajo del tope.
     */
    useEffect(() => {
      const hls = hlsRef.current as unknown as Parameters<typeof fijarCalidad>[0] | null;
      if (!hls) return;
      try {
        fijarCalidad(hls, resolverCalidad(settings.calidad, settings.calidadMaxima));
      } catch {
        /* limitar es un extra: nunca tumba la emisión */
      }
    }, [settings.calidad, settings.calidadMaxima]);

    const togglePlay = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) {
        video.play().then(() => setIsPlaying(true)).catch(() => {});
      } else {
        video.pause();
        setIsPlaying(false);
      }
    }, []);

    const toggleMute = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }, []);

    const requestFullscreen = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      if (document.fullscreenElement) document.exitFullscreen();
      else video.requestFullscreen?.();
    }, []);

    /**
     * Último recurso: ni en silencio arrancó. Ya no va de «activar sonido» sino
     * de reproducir, así que se reintenta en silencio —lo que siempre se
     * permite dentro de un gesto— y el sonido viene detrás si procede.
     */
    const handleEnableSound = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      setNeedsUserGesture(false);
      video.muted = true;
      setIsMuted(true);
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          recuperarSonido(video, true, () => true, setIsMuted);
        })
        .catch(() => setStreamError(true));
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        togglePlay,
        toggleMute,
        retry: handleRetry,
        requestFullscreen,
        video: () => videoRef.current,
      }),
      [togglePlay, toggleMute, handleRetry, requestFullscreen],
    );

    return (
      <div className={`relative h-full w-full overflow-hidden bg-black ${className}`}>
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          autoPlay
          muted={isMuted}
          /* Transmitir: sin estos tres atributos Safari no ofrece AirPlay
             sobre este vídeo y algunas TVs rechazan el flujo .m3u8 por CORS. */
          crossOrigin="anonymous"
          x-webkit-airplay="allow"
          disableRemotePlayback={false}
          style={{ objectFit: settings.ajusteImagen === "llenar" ? "cover" : "contain" }}
        />

        {/* Se rinde ante cualquiera de los otros dos avisos: si hay que
            activar el sonido o la señal falló, «Sintonizando…» ya no es
            verdad y taparía el botón que hay que pulsar. */}
        {sintonizando && !streamError && !needsUserGesture && (
          <div className="player-sintonizando" role="status">
            <span className="player-anillo" aria-hidden="true" />
            <p>Sintonizando {channel.name}…</p>
          </div>
        )}

        {/* Tirón a mitad de emisión: ya hubo imagen, así que no es sintonizar
            de nuevo, solo un aviso pequeño que no tapa los controles. */}
        {!sintonizando && emision.buffering && !streamError && !needsUserGesture && (
          <div className="player-sintonizando is-buffering" role="status" aria-label="Recargando">
            <span className="player-anillo" aria-hidden="true" />
          </div>
        )}

        {needsUserGesture && !streamError && (
          <div role="alert" className="player-fallo">
            <Play aria-hidden="true" strokeWidth={1.5} className="mb-2 h-12 w-12 text-accent" />
            <p className="player-fallo-titulo">Toca para reproducir</p>
            <p className="player-fallo-detalle">
              Este navegador no deja arrancar el vídeo por su cuenta, ni siquiera en silencio.
            </p>
            <button
              type="button"
              data-nav="button"
              autoFocus
              onClick={handleEnableSound}
              className="player-btn is-primary"
            >
              <Play aria-hidden="true" />
              Reproducir
            </button>
          </div>
        )}

        {streamError && (
          <div role="alert" className="player-fallo">
            <Radio aria-hidden="true" strokeWidth={1.5} className="mb-2 h-12 w-12 text-live" />
            <p className="player-fallo-titulo">Sin señal</p>
            <p className="player-fallo-detalle">
              La fuente no respondió o el formato no es compatible. Suele ser un corte momentáneo
              del proveedor.
            </p>
            <button
              type="button"
              data-nav="button"
              autoFocus
              onClick={handleRetry}
              className="player-btn is-primary"
            >
              <RefreshCw aria-hidden="true" />
              Reintentar
            </button>
          </div>
        )}
      </div>
    );
  }),
);

export default StreamPlayer;
