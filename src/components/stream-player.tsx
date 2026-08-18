"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { Maximize, Pause, Play, RefreshCw, Radio, Sparkles, Volume1, Volume2, VolumeX } from "lucide-react";
import type { Channel } from "@/lib/types";

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

const StreamPlayer = memo(function StreamPlayer({ channel }: { channel: Channel }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<ReturnType<typeof mpegts.createPlayer> | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [streamError, setStreamError] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streamUrl = channel.streamUrl;

  const handleRetry = useCallback(() => {
    setRetryCount((n) => n + 1);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setStreamError(false);
    setNeedsUserGesture(false);
    video.muted = false;
    setIsMuted(false);

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
      video.play().then(() => {
        if (!cancelled) setIsPlaying(true);
      }).catch(() => {
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

    const kind = getStreamKind(streamUrl);

    if (kind === "hls") {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
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
          { enableWorker: true, liveBufferLatencyChasing: true }
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
  }, [channel.id, streamUrl, retryCount]);

  // Auto-ocultar controles en TV después de 4s
  useEffect(() => {
    const show = () => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
    };
    show();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [channel.id]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
    setShowControls(true);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    setShowControls(true);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
    setShowControls(true);
  }, []);

  const handleEnableSound = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setNeedsUserGesture(false);
    video.muted = false;
    setIsMuted(false);
    video.play().then(() => setIsPlaying(true)).catch(() => setStreamError(true));
  }, []);

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-slate-200 group"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        autoPlay
        muted={isMuted}
      />

      {/* Header flotante */}
      <div className={`absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 flex items-center justify-between transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-red-500">
            EN VIVO
          </span>
          <span className="text-sm font-semibold text-white/90">
            {channel.number} • {channel.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-100 backdrop-blur-md border border-emerald-500/30">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          <span>Reproducción Nativa</span>
        </div>
      </div>

      {/* Controles del reproductor */}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex items-center justify-between transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pausar (espacio)" : "Reproducir (espacio)"}
            className="p-3 rounded-xl bg-white/15 hover:bg-white/20 text-white backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {isPlaying ? <Pause aria-hidden="true" className="h-5 w-5" /> : <Play aria-hidden="true" className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Activar sonido (M)" : "Silenciar (M)"}
            aria-pressed={isMuted}
            className="p-3 rounded-xl bg-white/15 hover:bg-white/20 text-white backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {isMuted ? <VolumeX aria-hidden="true" className="h-5 w-5" /> : <Volume2 aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>

        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Pantalla completa (F)"
          className="p-3 rounded-xl bg-white/15 hover:bg-white/20 text-white backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <Maximize aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      {needsUserGesture && !streamError && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 p-6 text-center z-10">
          <Volume1 aria-hidden="true" className="h-14 w-14 text-teal-600 mb-4 animate-pulse" />
          <p className="text-xl font-bold text-white mb-1">Activar sonido</p>
          <p className="text-sm text-slate-500 max-w-sm mb-5">
            Presiona para reproducir con audio.
          </p>
          <button
            type="button"
            onClick={handleEnableSound}
            className="btn-primary text-base px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-teal-600/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            🔊 Activar sonido
          </button>
        </div>
      )}

      {streamError && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 p-6 text-center z-10">
          <Radio aria-hidden="true" className="h-12 w-12 text-red-500 mb-3 animate-pulse" />
          <p className="text-lg font-bold text-white">Error de Reproducción</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mb-4">
            La señal no respondió o el formato no es compatible. Puede ser un corte momentáneo de la fuente.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-teal-600/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
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
