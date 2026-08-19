"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import {
  Cast,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RefreshCw,
  Radio,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Channel } from "@/lib/types";
import { useCast } from "@/hooks/use-cast";
import { useFullscreen } from "@/hooks/use-fullscreen";

/** Motor de reproducción según el formato. Sin extensión asumimos HLS: es lo más común en IPTV. */
function detectStreamKind(url: string): "hls" | "mpegts" | "flv" | "native" {
  const path = url.toLowerCase().split("?")[0];
  if (path.endsWith(".flv")) return "flv";
  if (path.endsWith(".ts")) return "mpegts";
  if (/\.(mp4|webm|mkv|mov|m4v)$/.test(path)) return "native";
  return "hls";
}

/** Reintentos ante fallos recuperables antes de darse por vencido. */
const MAX_RECOVERY_ATTEMPTS = 3;

/**
 * ¿Conviene reproducir HLS de forma nativa en vez de con hls.js?
 *
 * Importa para AirPlay: el Apple TV necesita una **URL real** que reproducir.
 * Con MSE (Media Source Extensions) el <video> se alimenta de un blob sin URL,
 * así que AirPlay solo consigue llevarse el audio y la TV se queda sin imagen.
 *
 * Y esto no es teórico en iPhone: desde iOS 17.1 Safari expone
 * `ManagedMediaSource`, que hls.js toma como MSE válido, por lo que
 * `Hls.isSupported()` devuelve true también en el teléfono. Si no lo
 * comprobáramos antes, en iPhone siempre acabaríamos en la rama MSE.
 *
 * En Chrome de Android `canPlayType` puede devolver "maybe" para HLS aunque lo
 * reproduzca mal, por eso solo preferimos lo nativo si la respuesta es
 * "probably" o si el navegador es WebKit con AirPlay.
 */
function shouldUseNativeHls(video: HTMLVideoElement): boolean {
  const support = video.canPlayType("application/vnd.apple.mpegurl");
  if (support === "") return false;
  if (support === "probably") return true;
  return typeof window !== "undefined" && "WebKitPlaybackTargetAvailabilityEvent" in window;
}

const StreamPlayer = memo(function StreamPlayer({ channel }: { channel: Channel }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const { streamUrl, name } = channel;
  const { canCast, isCasting, startCasting } = useCast(videoRef, streamUrl, name);
  const { isFullscreen, isSupported: canFullscreen, toggleFullscreen } = useFullscreen(containerRef, videoRef);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    let cancelled = false;
    let recoveryAttempts = 0;

    setHasError(false);
    setNeedsUserGesture(false);
    setIsLoading(true);
    video.muted = false;
    setIsMuted(false);

    const destroyEngines = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      mpegtsRef.current?.destroy();
      mpegtsRef.current = null;
    };

    destroyEngines();
    video.removeAttribute("src");
    video.load();

    const fail = () => {
      if (!cancelled) {
        setHasError(true);
        setIsLoading(false);
      }
    };

    const tryPlay = () => {
      if (cancelled) return;
      video
        .play()
        .then(() => {
          if (cancelled) return;
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          // El navegador bloqueó el autoplay con audio. No silenciamos:
          // pedimos un toque al usuario, que además habilita el sonido.
          setNeedsUserGesture(true);
          setIsPlaying(false);
          setIsLoading(false);
        });
    };

    const kind = detectStreamKind(streamUrl);

    if (kind === "hls") {
      if (shouldUseNativeHls(video)) {
        // Safari/iOS: reproducción nativa, que es la única que permite mandar
        // imagen por AirPlay (ver shouldUseNativeHls).
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", tryPlay, { once: true });
      } else if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          // Tolerancia a cortes momentáneos de señal, comunes en IPTV público.
          fragLoadingMaxRetry: 4,
          manifestLoadingMaxRetry: 3,
          levelLoadingMaxRetry: 4,
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (cancelled || !data.fatal) return;
          // Los fallos fatales suelen ser recuperables: reintentamos en vez de
          // dejar la pantalla de error a la primera.
          if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
            destroyEngines();
            fail();
            return;
          }
          recoveryAttempts++;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            setIsLoading(true);
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            setIsLoading(true);
            hls.recoverMediaError();
          } else {
            destroyEngines();
            fail();
          }
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Último recurso: el navegador dice reproducir HLS aunque sin MSE.
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", tryPlay, { once: true });
      } else {
        fail();
      }
    } else if (kind === "mpegts" || kind === "flv") {
      if (mpegts.isSupported()) {
        const player = mpegts.createPlayer(
          { type: kind === "flv" ? "flv" : "mpegts", url: streamUrl, isLive: true },
          { enableWorker: true, liveBufferLatencyChasing: true }
        );
        mpegtsRef.current = player;
        player.on(mpegts.Events.ERROR, fail);
        player.attachMediaElement(video);
        player.load();
        tryPlay();
      } else {
        video.src = streamUrl;
        tryPlay();
      }
    } else {
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", tryPlay, { once: true });
    }

    const handleNativeError = () => {
      // Con hls.js activo el <video> puede emitir error mientras se recupera:
      // ese caso ya lo maneja el listener de Hls.Events.ERROR.
      if (!hlsRef.current) fail();
    };
    const handleWaiting = () => !cancelled && setIsLoading(true);
    const handlePlaying = () => {
      if (cancelled) return;
      setIsLoading(false);
      setIsPlaying(true);
      setHasError(false);
    };
    const handlePause = () => !cancelled && setIsPlaying(false);

    video.addEventListener("error", handleNativeError);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);
    video.addEventListener("pause", handlePause);

    return () => {
      cancelled = true;
      video.removeEventListener("error", handleNativeError);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
      video.removeEventListener("pause", handlePause);
      destroyEngines();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [channel.id, streamUrl, retryCount]);

  // Los controles se ocultan solos para no estorbar en la TV.
  useEffect(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 4000);
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [channel.id]);

  const revealControls = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().then(() => setIsPlaying(true)).catch(() => {});
    else {
      video.pause();
      setIsPlaying(false);
    }
    revealControls();
  }, [revealControls]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    revealControls();
  }, [revealControls]);

  const enableSound = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setNeedsUserGesture(false);
    video.muted = false;
    setIsMuted(false);
    video.play().then(() => setIsPlaying(true)).catch(() => setHasError(true));
  }, []);

  const controlsVisible = showControls || !isPlaying;

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden bg-black"
      onMouseMove={revealControls}
      onMouseLeave={() => setShowControls(false)}
      onTouchStart={revealControls}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        autoPlay
        muted={isMuted}
        // Permite que Safari ofrezca AirPlay sobre este video.
        x-webkit-airplay="allow"
      />

      {/* Encabezado flotante */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-3 transition-opacity duration-300 sm:p-4 ${
          controlsVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-red-500">En vivo</span>
          <span className="truncate text-xs font-semibold text-white/90 sm:text-sm">
            {channel.number} • {channel.name}
          </span>
        </div>
        {isCasting && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-sky-500/25 px-2.5 py-1 text-[11px] font-semibold text-sky-100 backdrop-blur-md">
            <Cast aria-hidden="true" className="h-3.5 w-3.5" />
            En la TV
          </span>
        )}
      </div>

      {/* Controles */}
      <div
        className={`absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 transition-opacity duration-300 sm:p-4 ${
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pausar (espacio)" : "Reproducir (espacio)"}
            className="rounded-xl bg-white/15 p-3 text-white backdrop-blur-md transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {isPlaying ? <Pause aria-hidden="true" className="h-5 w-5" /> : <Play aria-hidden="true" className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Activar sonido (M)" : "Silenciar (M)"}
            aria-pressed={isMuted}
            className="rounded-xl bg-white/15 p-3 text-white backdrop-blur-md transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {isMuted ? <VolumeX aria-hidden="true" className="h-5 w-5" /> : <Volume2 aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {canCast && (
            <button
              type="button"
              onClick={startCasting}
              aria-label="Transmitir a la TV"
              className={`rounded-xl p-3 text-white backdrop-blur-md transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                isCasting ? "bg-sky-500/40" : "bg-white/15"
              }`}
            >
              <Cast aria-hidden="true" className="h-5 w-5" />
            </button>
          )}
          {canFullscreen && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Salir de pantalla completa (F)" : "Pantalla completa (F)"}
              className="rounded-xl bg-white/15 p-3 text-white backdrop-blur-md transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {isFullscreen ? (
                <Minimize aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Maximize aria-hidden="true" className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {isLoading && !hasError && !needsUserGesture && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status">
          <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin text-white/70" />
          <span className="sr-only">Cargando canal…</span>
        </div>
      )}

      {needsUserGesture && !hasError && (
        <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/90 p-6 text-center">
          <Volume1 aria-hidden="true" className="mb-4 h-14 w-14 animate-pulse text-teal-400" />
          <p className="mb-1 text-xl font-bold text-white">Toca para ver</p>
          <p className="mb-5 max-w-sm text-sm text-slate-400">El navegador pide un toque antes de reproducir con sonido.</p>
          <button
            type="button"
            onClick={enableSound}
            className="rounded-xl bg-emerald-600 px-8 py-3 text-base font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            ▶ Reproducir
          </button>
        </div>
      )}

      {hasError && (
        <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/95 p-6 text-center">
          <Radio aria-hidden="true" className="mb-3 h-12 w-12 animate-pulse text-red-500" />
          <p className="text-lg font-bold text-white">No se pudo abrir el canal</p>
          <p className="mb-4 mt-1 max-w-sm text-sm text-slate-400">
            La señal no respondió. Puede ser un corte momentáneo: intenta de nuevo o elige otro canal.
          </p>
          <button
            type="button"
            onClick={retry}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
});

export default StreamPlayer;
