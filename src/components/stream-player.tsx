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
import { RefreshCw, Radio, Volume1 } from "lucide-react";
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
}

interface StreamPlayerProps {
  channel: Channel;
  settings?: PlaybackSettings;
  /** El padre refleja play/mute/error en su propio chrome. */
  onStateChange?: (state: StreamPlayerState) => void;
  className?: string;
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

    const streamUrl = channel.streamUrl;

    const handleRetry = useCallback(() => {
      setRetryCount((n) => n + 1);
    }, []);

    useEffect(() => {
      onStateChange?.({ isPlaying, isMuted, streamError, needsUserGesture });
    }, [isPlaying, isMuted, streamError, needsUserGesture, onStateChange]);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      let cancelled = false;
      setStreamError(false);
      setNeedsUserGesture(false);
      setSintonizando(true);
      video.muted = !settings.startUnmuted;
      setIsMuted(!settings.startUnmuted);

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
            if (!cancelled) setIsPlaying(true);
          })
          .catch(() => {
            if (cancelled) return;
            video.muted = true;
            setIsMuted(true);
            video
              .play()
              .then(() => {
                if (!cancelled) setIsPlaying(true);
              })
              .catch(() => {
                if (cancelled) return;
                setNeedsUserGesture(true);
                setIsPlaying(false);
              });
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
      const yaSeVe = () => setSintonizando(false);
      video.addEventListener("playing", yaSeVe);
      video.addEventListener("loadeddata", yaSeVe);

      return () => {
        cancelled = true;
        video.removeEventListener("error", handleNativeError);
        video.removeEventListener("playing", yaSeVe);
        video.removeEventListener("loadeddata", yaSeVe);
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

    const handleEnableSound = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      setNeedsUserGesture(false);
      video.muted = false;
      setIsMuted(false);
      video.play().then(() => setIsPlaying(true)).catch(() => setStreamError(true));
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
          <div
            role="alert"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-app/92 p-8 text-center backdrop-blur-sm"
          >
            <Volume1 aria-hidden="true" strokeWidth={1.5} className="mb-5 h-14 w-14 text-accent" />
            <p className="mb-2 text-2xl font-semibold tracking-tight">Activar sonido</p>
            <p className="mb-7 max-w-sm text-[15px] text-muted">
              El televisor bloqueó el audio al arrancar. Presiona OK para reproducir con sonido.
            </p>
            <button
              type="button"
              data-nav="button"
              autoFocus
              onClick={handleEnableSound}
              className="inline-flex min-h-[52px] items-center gap-3 rounded-2xl bg-accent px-8 text-base font-semibold text-accent-on"
            >
              Activar sonido
            </button>
          </div>
        )}

        {streamError && (
          <div
            role="alert"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-app/95 p-8 text-center"
          >
            <Radio aria-hidden="true" strokeWidth={1.5} className="mb-4 h-12 w-12 text-live" />
            <p className="mb-2 text-2xl font-semibold tracking-tight">Sin señal</p>
            <p className="mb-7 max-w-md text-[15px] text-muted">
              La fuente no respondió o el formato no es compatible. Suele ser un corte momentáneo
              del proveedor.
            </p>
            <button
              type="button"
              data-nav="button"
              autoFocus
              onClick={handleRetry}
              className="inline-flex min-h-[52px] items-center gap-3 rounded-2xl bg-accent px-8 text-base font-semibold text-accent-on"
            >
              <RefreshCw aria-hidden="true" strokeWidth={1.5} className="h-[18px] w-[18px]" />
              Reintentar
            </button>
          </div>
        )}
      </div>
    );
  }),
);

export default StreamPlayer;
