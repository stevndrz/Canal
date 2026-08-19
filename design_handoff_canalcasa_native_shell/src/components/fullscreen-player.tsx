"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { List, Minimize, Pause, Play, Star, Volume2, VolumeX } from "lucide-react";
import type { Channel, PlaybackSettings } from "@/lib/types";
import StreamPlayer, {
  type StreamPlayerHandle,
  type StreamPlayerState,
} from "@/components/stream-player";
import { channelMark, stepChannel } from "@/lib/channels";

interface FullscreenPlayerProps {
  channel: Channel;
  /** Lista visible: define qué zapea ↑↓ y qué muestra la guía. */
  playlist: Channel[];
  favorites: Set<number>;
  settings: PlaybackSettings;
  onTune: (channel: Channel) => void;
  onToggleFavorite: (id: number) => void;
  onExit: () => void;
  clock: string;
}

const CONTROLS_TIMEOUT = 4000;
const GUIDE_TIMEOUT = 5000;

export function FullscreenPlayer({
  channel,
  playlist,
  favorites,
  settings,
  onTune,
  onToggleFavorite,
  onExit,
  clock,
}: FullscreenPlayerProps) {
  const playerRef = useRef<StreamPlayerHandle | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);

  const [showControls, setShowControls] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [state, setState] = useState<StreamPlayerState>({
    isPlaying: true,
    isMuted: false,
    streamError: false,
    needsUserGesture: false,
  });

  const isFavorite = favorites.has(channel.id);

  const wake = useCallback(() => {
    setShowControls(true);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), CONTROLS_TIMEOUT);
  }, []);

  const openGuide = useCallback(() => {
    setShowGuide(true);
    if (guideTimer.current) clearTimeout(guideTimer.current);
    guideTimer.current = setTimeout(() => setShowGuide(false), GUIDE_TIMEOUT);
  }, []);

  const zap = useCallback(
    (delta: number) => {
      const next = stepChannel(playlist, channel.id, delta);
      if (!next) return;
      onTune(next);
      openGuide();
      wake();
    },
    [playlist, channel.id, onTune, openGuide, wake],
  );

  useEffect(() => {
    wake();
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      if (guideTimer.current) clearTimeout(guideTimer.current);
    };
  }, [channel.id, wake]);

  // Mantén el canal sintonizado a la vista dentro de la guía.
  useEffect(() => {
    if (!showGuide) return;
    const rail = railRef.current;
    const active = rail?.querySelector<HTMLElement>(`[data-guide-id="${channel.id}"]`);
    if (rail && active) {
      const ar = active.getBoundingClientRect();
      const rr = rail.getBoundingClientRect();
      if (ar.left < rr.left + 28) rail.scrollLeft += ar.left - rr.left - 28;
      else if (ar.right > rr.right - 28) rail.scrollLeft += ar.right - rr.right + 28;
    }
  }, [showGuide, channel.id]);

  // El mando manda: ↑↓ zapea, OK abre la guía, Atrás sale.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowUp":
        case "ArrowLeft":
          event.preventDefault();
          zap(-1);
          return;
        case "ArrowDown":
        case "ArrowRight":
          event.preventDefault();
          zap(1);
          return;
        case "Enter":
          event.preventDefault();
          if (showGuide) setShowGuide(false);
          else openGuide();
          return;
        case " ":
        case "k":
          event.preventDefault();
          playerRef.current?.togglePlay();
          wake();
          return;
        case "m":
        case "M":
          playerRef.current?.toggleMute();
          wake();
          return;
        default:
          wake();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zap, showGuide, openGuide, wake]);

  const controlClass =
    "grid h-[58px] w-[58px] place-items-center rounded-2xl border border-white/12 bg-white/12 text-accent backdrop-blur-md";

  return (
    <div className="absolute inset-0 z-20 bg-black" onMouseMove={wake}>
      <StreamPlayer
        ref={playerRef}
        channel={channel}
        settings={settings}
        onStateChange={setState}
      />

      {/* Cabecera */}
      <div
        className={`tv-safe pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-6 bg-gradient-to-b from-black/78 to-transparent py-7 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex min-w-0 items-center gap-4.5">
          <span className="flex shrink-0 items-center gap-2.5 text-[13px] font-semibold tracking-[0.16em]">
            <span className="live-dot h-[7px] w-[7px] rounded-full bg-live" />
            EN VIVO
          </span>
          <span className="truncate text-[22px] font-semibold tracking-tight">
            {channel.number} · {channel.name}
          </span>
          <span className="shrink-0 text-sm text-zinc-100/50">{channel.category}</span>
        </div>
        <span className="shrink-0 font-mono text-sm text-zinc-100/60">{clock}</span>
      </div>

      {/* Controles */}
      <div
        className={`tv-safe absolute inset-x-0 bottom-0 z-30 flex items-center justify-between gap-6 bg-gradient-to-t from-black/85 to-transparent py-7 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-nav="button"
            aria-label={state.isPlaying ? "Pausar" : "Reproducir"}
            onClick={() => {
              playerRef.current?.togglePlay();
              wake();
            }}
            className="grid h-[58px] w-[58px] place-items-center rounded-2xl bg-accent text-accent-on"
          >
            {state.isPlaying ? (
              <Pause aria-hidden="true" strokeWidth={1.5} className="h-[22px] w-[22px]" />
            ) : (
              <Play aria-hidden="true" strokeWidth={1.5} className="h-[22px] w-[22px]" />
            )}
          </button>

          <button
            type="button"
            data-nav="button"
            aria-label={state.isMuted ? "Activar sonido" : "Silenciar"}
            aria-pressed={state.isMuted}
            onClick={() => {
              playerRef.current?.toggleMute();
              wake();
            }}
            className={controlClass}
          >
            {state.isMuted ? (
              <VolumeX aria-hidden="true" strokeWidth={1.5} className="h-[22px] w-[22px]" />
            ) : (
              <Volume2 aria-hidden="true" strokeWidth={1.5} className="h-[22px] w-[22px]" />
            )}
          </button>

          <button
            type="button"
            data-nav="button"
            aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
            aria-pressed={isFavorite}
            onClick={() => {
              onToggleFavorite(channel.id);
              wake();
            }}
            className={controlClass}
          >
            <Star
              aria-hidden="true"
              strokeWidth={1.5}
              className={`h-5 w-5 ${isFavorite ? "fill-accent" : ""}`}
            />
          </button>

          <button
            type="button"
            data-nav="button"
            aria-label="Guía de canales"
            aria-expanded={showGuide}
            onClick={() => (showGuide ? setShowGuide(false) : openGuide())}
            className={controlClass}
          >
            <List aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
          </button>

          <button
            type="button"
            data-nav="button"
            aria-label="Salir de pantalla completa"
            onClick={onExit}
            className={controlClass}
          >
            <Minimize aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
          </button>
        </div>

        <div className="hidden items-center gap-5 text-[13px] text-zinc-100/50 lg:flex">
          <span>↑↓ cambiar canal</span>
          <span>OK guía</span>
          <span>Atrás salir</span>
        </div>
      </div>

      {/* Guía: la cuadrícula vuelve como overlay translúcido, sin salir del vivo */}
      {showGuide && (
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-app/92 via-app/55 to-transparent pt-6 pb-32 backdrop-blur-xl">
          <div className="tv-safe flex items-baseline justify-between gap-4 pb-4">
            <span className="text-xs uppercase tracking-[0.16em] text-zinc-100/55">
              {playlist.length} canales
            </span>
            <span className="text-[13px] text-zinc-100/40">← → recorrer · OK sintonizar</span>
          </div>

          <div ref={railRef} className="scroll-none tv-safe flex gap-3.5 overflow-x-auto py-1.5">
            {playlist.map((item) => {
              const tuned = item.id === channel.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-guide-id={item.id}
                  onClick={() => {
                    onTune(item);
                    openGuide();
                  }}
                  style={{ flex: "0 0 196px", width: 196 }}
                  className={`rounded-tile text-left ${
                    tuned ? "outline outline-[3px] outline-offset-4 outline-accent" : ""
                  }`}
                >
                  <div className="relative grid aspect-video place-items-center overflow-hidden rounded-xl border border-white/[0.09] bg-surface-2/90">
                    <span className="text-2xl font-bold text-zinc-100/40">
                      {channelMark(item)}
                    </span>
                    <span className="absolute left-2.5 top-1.5 font-mono text-[11px] text-zinc-100/45">
                      {item.number}
                    </span>
                  </div>
                  <p className="mt-2 truncate px-0.5 text-sm font-medium">{item.name}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
