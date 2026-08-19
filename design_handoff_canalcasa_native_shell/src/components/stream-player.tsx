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
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { RefreshCw, Radio, Volume1 } from "lucide-react";
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
// Por defecto asumimos HLS: es el formato dominante en listas IPTV públicas,
// incluso cuando la URL no termina en .m3u8.
function getStreamKind(url: string): "hls" | "mpegts" | "flv" | "native" {
  const clean = url.toLowerCase().split("?")[0];
  if (/\.flv$/.test(clean)) return "flv";
  if (/\.ts$/.test(clean)) return "mpegts";
  if (/\.(mp4|webm|mkv|mov)$/.test(clean)) return "native";
  return "hls";
}

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
    const hlsRef = useRef<Hls | null>(null);
    const mpegtsRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [streamError, setStreamError] = useState(false);
    const [needsUserGesture, setNeedsUserGesture] = useState(false);
    const [retryCount, setRetryCount] = useState(0);

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

      const tryPlay = () => {
        if (cancelled) return;
        video
          .play()
          .then(() => {
            if (!cancelled) setIsPlaying(true);
          })
          .catch(() => {
            if (cancelled) return;
            // El navegador bloqueó el autoplay con audio.
            // NO muteamos — mostramos un overlay pidiendo un click.
            setNeedsUserGesture(true);
            setIsPlaying(false);
          });
      };

      const handleFatalError = () => {
        if (!cancelled) setStreamError(true);
      };

      const detected = getStreamKind(streamUrl);
      const kind =
        settings.engine === "hls"
          ? "hls"
          : settings.engine === "mpegts"
            ? "mpegts"
            : detected;

      if (kind === "hls") {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: settings.enableWorker,
            lowLatencyMode: settings.lowLatencyMode,
          });
          hlsRef.current = hls;
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) handleFatalError();
          });
          hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = streamUrl;
          video.addEventListener("loadedmetadata", tryPlay, { once: true });
        } else {
          handleFatalError();
        }
      } else if (kind === "mpegts" || kind === "flv") {
        if (mpegts.isSupported()) {
          const player = mpegts.createPlayer(
            { type: kind === "flv" ? "flv" : "mpegts", url: streamUrl, isLive: true },
            {
              enableWorker: settings.enableWorker,
              liveBufferLatencyChasing: settings.liveBufferLatencyChasing,
            },
          );
          mpegtsRef.current = player;
          player.on(mpegts.Events.ERROR, handleFatalError);
          player.attachMediaElement(video);
          player.load();
          tryPlay();
        } else {
          video.src = streamUrl;
          tryPlay();
        }
      } else {
        video.src = streamUrl;
        tryPlay();
      }

      const handleNativeError = () => handleFatalError();
      video.addEventListener("error", handleNativeError);

      return () => {
        cancelled = true;
        video.removeEventListener("error", handleNativeError);
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      channel.id,
      streamUrl,
      retryCount,
      settings.engine,
      settings.enableWorker,
      settings.lowLatencyMode,
      settings.liveBufferLatencyChasing,
      settings.startUnmuted,
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
        />

        {needsUserGesture && !streamError && (
          <div
            role="alert"
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-app/92 p-8 text-center backdrop-blur-sm"
          >
            <Volume1 aria-hidden="true" strokeWidth={1.5} className="mb-5 h-14 w-14 text-accent" />
            <p className="mb-2 text-2xl font-semibold tracking-tight">Activar sonido</p>
            <p className="mb-7 max-w-sm text-[15px] text-zinc-400">
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
            <p className="mb-7 max-w-md text-[15px] text-zinc-400">
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
