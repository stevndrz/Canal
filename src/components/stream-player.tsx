"use client";

import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Play, RefreshCw, Radio } from "lucide-react";
import { claseDeEmision, montarMotor, type MotorMontado } from "@/lib/reproduccion/motor";
import type { Channel, PlaybackSettings } from "@/lib/types";
import { DEFAULT_PLAYBACK } from "@/lib/types";

/**
 * ⚠️ La selección de motor y el ciclo de vida de hls.js / mpegts.js son los
 * del proyecto original, sin cambios de comportamiento. Lo único nuevo:
 * - la superficie es un <video> pelado (el chrome lo dibuja quien lo monta),
 * - los flags de Ajustes entran por props,
 * - se expone un handle imperativo para que los controles vivan fuera.
 */

// Determina el motor de reproducción según el formato del stream.


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
}

interface StreamPlayerProps {
  channel: Channel;
  settings?: PlaybackSettings;
  /** El padre refleja play/mute/error en su propio chrome. */
  onStateChange?: (state: StreamPlayerState) => void;
  className?: string;
}

/**
 * Devolver el sonido a un vídeo que ya arrancó en silencio.
 *
 * No hay una forma limpia de preguntar «¿puedo sonar?», así que hay dos vías:
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
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [streamError, setStreamError] = useState(false);
    const [needsUserGesture, setNeedsUserGesture] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    /**
     * Entre pulsar un canal y el primer fotograma no había nada: negro y
     * silencio, sin ninguna pista de si el mando había hecho caso. En una
     * lista de 7.822 canales, donde muchos tardan o no responden, eso es la
     * diferencia entre esperar y volver a pulsar OK cuatro veces.
     */
    const [sintonizando, setSintonizando] = useState(true);
    /**
     * Lo que se está reproduciendo de verdad. Ver `StreamPlayerState`.
     *
     * Se guarda junto y no en tres estados sueltos porque llega junto: los dos
     * eventos que lo mueven —`resize` del vídeo y el cambio de pista de
     * hls.js— traen la foto entera, y tres `setState` seguidos serían tres
     * renders para pintar una sola línea de texto.
     */
    const [emision, setEmision] = useState<{
      ancho?: number;
      alto?: number;
      bitrate?: number;
    }>({});

    const streamUrl = channel.streamUrl;

    const handleRetry = useCallback(() => {
      setRetryCount((n) => n + 1);
    }, []);

    useEffect(() => {
      onStateChange?.({ isPlaying, isMuted, streamError, needsUserGesture, ...emision });
    }, [isPlaying, isMuted, streamError, needsUserGesture, emision, onStateChange]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      let cancelled = false;
      setStreamError(false);
      setNeedsUserGesture(false);
      setSintonizando(true);
      // La emisión anterior no dice nada de la nueva: dejar puesta su
      // resolución enseñaría 1080p mientras arranca un canal que es 480p.
      setEmision({});
      /**
       * **Se arranca SIEMPRE en silencio.**
       *
       * Reproducir en silencio lo permiten todos los navegadores sin pedir
       * nada; reproducir con sonido, ninguno, hasta que la persona haya tocado
       * algo. Antes se intentaba primero con sonido, y cuando el navegador lo
       * rechazaba se podía acabar con un cartel de «Activar sonido» tapando el
       * vídeo: quien abre una app de televisión quiere ver imagen, no leer un
       * aviso y buscar dónde pulsar.
       *
       * El sonido se recupera abajo, en cuanto se sabe que se puede, o con el
       * botón de la barra, que es donde se busca.
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

      /**
       * Arrancar siempre, aunque sea en silencio.
       *
       * Antes, si el navegador bloqueaba el autoplay con audio, se tapaba el
       * vídeo con un cartel de "Activar sonido" y no sonaba **ni se veía** nada
       * hasta que alguien lo pulsara. Eso es exactamente al revés de lo que
       * quiere quien abre una app de televisión: la imagen tiene que estar ahí.
       *
       * Todos los navegadores permiten el autoplay en silencio, así que ante un
       * bloqueo se silencia y se reintenta. El botón de sonido de la barra
       * queda como lo que es: un control, no un peaje.
       *
       * El cartel solo sobrevive para el caso raro en que ni siquiera en
       * silencio se pueda reproducir; ahí sí no hay nada que enseñar.
       */
      const tryPlay = () => {
        if (cancelled) return;
        video
          .play()
          .then(() => {
            if (cancelled) return;
            setIsPlaying(true);
            recuperarSonido(video, settings.startUnmuted, () => !cancelled, setIsMuted);
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
        if (!cancelled) setStreamError(true);
      };

      const clase =
        settings.engine === "hls"
          ? "hls"
          : settings.engine === "mpegts"
            ? "mpegts"
            : claseDeEmision(streamUrl);

      // El motor se monta aparte: qué librería reproduce cada enlace es una
      // decisión propia, no parte del ciclo de vida de este componente.
      void montarMotor({
        video,
        url: streamUrl,
        clase,
        // Solo lo que el motor usa, y campo a campo: así las dependencias del
        // efecto siguen siendo granulares y cambiar un ajuste que no le
        // incumbe no reinicia la emisión.
        settings: {
          enableWorker: settings.enableWorker,
          lowLatencyMode: settings.lowLatencyMode,
          liveBufferLatencyChasing: settings.liveBufferLatencyChasing,
          calidadMaxima: settings.calidadMaxima,
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
         * El bitrate, cuando hay quien lo sepa.
         *
         * Solo hls.js conoce las pistas y cuál está sonando. Con mpegts.js o
         * con el HLS nativo de Safari no hay de dónde sacarlo, y ahí el campo
         * se queda sin poner: quien lo pinta esconde el módulo entero en vez
         * de enseñar un hueco. Antes que un dato inventado, ninguno.
         *
         * Se lee de forma defensiva porque `levels` y `currentLevel` no están
         * en el tipo público que usa este archivo, y porque una versión vieja
         * de la librería podría no traerlos.
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
       * Se quita el aviso en cuanto hay **imagen**, no en cuanto hay datos.
       *
       * `playing` es el evento que de verdad significa «se está viendo algo»;
       * `loadeddata` va detrás por si un televisor no dispara el primero al
       * arrancar en silencio, que pasa. Los dos apuntan a lo mismo y el
       * `setState` es idempotente, así que sobra con que llegue uno.
       */
      const yaSeVe = () => {
        setSintonizando(false);
        // Si al final hay imagen, el cartel de «no se pudo reproducir» ya no
        // es verdad: antes se quedaba puesto tapando un vídeo que iba bien.
        setNeedsUserGesture(false);
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
      video.addEventListener("resize", medirImagen);
      video.addEventListener("loadedmetadata", medirImagen);
      video.addEventListener("playing", yaSeVe);
      video.addEventListener("loadeddata", yaSeVe);

      return () => {
        cancelled = true;
        video.removeEventListener("error", handleNativeError);
        video.removeEventListener("playing", yaSeVe);
        video.removeEventListener("loadeddata", yaSeVe);
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
      retryCount,
      settings.engine,
      settings.enableWorker,
      settings.lowLatencyMode,
      settings.liveBufferLatencyChasing,
      settings.startUnmuted,
      // Cambiar "calidad máxima" tiene que rearrancar hls.js: `startLevel` y
      // `capLevelToPlayerSize` solo se leen al construir la instancia.
      settings.calidadMaxima,
    ]);

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
     * El último recurso: ni en silencio se pudo arrancar.
     *
     * Ya no es «activar sonido» —eso lo resuelve `recuperarSonido` o el botón
     * de la barra—, es simplemente reproducir. Se reintenta en silencio, que
     * es lo que siempre se permite dentro de un gesto; el sonido viene detrás
     * si procede.
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
