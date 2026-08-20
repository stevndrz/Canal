"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Cast, List, Minimize, Pause, Play, SkipForward, Users, Volume2, VolumeX } from "lucide-react";
import type { Channel, PlaybackSettings } from "@/lib/types";
import StreamPlayer, {
  type StreamPlayerHandle,
  type StreamPlayerState,
} from "@/components/stream-player";
import { channelMark, stepChannel } from "@/lib/channels";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useCast } from "@/hooks/use-cast";
import { useWatchParty } from "@/hooks/use-watch-party";
import { normalizeRoomId } from "@/lib/watch-party/sign";

interface FullscreenPlayerProps {
  channel: Channel;
  /** Lista visible: define qué zapea ↑↓ y qué muestra la guía. */
  playlist: Channel[];
  favorites: Set<number>;
  settings: PlaybackSettings;
  onTune: (channel: Channel) => void;
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
  onExit,
  clock,
}: FullscreenPlayerProps) {
  const playerRef = useRef<StreamPlayerHandle | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  // El <video> real vive dentro de StreamPlayer y se expone por método
  // imperativo, no por ref directa: `videoElRef.current` hay que copiarlo a
  // mano en vez de que React lo rellene solo al montar. Tiene que ser
  // `useLayoutEffect`, no `useEffect`: los hooks de abajo (useCast,
  // useWatchParty) leen `videoElRef.current` en SU PROPIO useEffect, que se
  // dispara en el mismo commit — con useEffect aquí, el suyo se ejecutaba
  // primero y siempre veía `null`, así que Chromecast/AirPlay nunca se
  // detectaban. useLayoutEffect corre antes que cualquier useEffect del
  // árbol, sin importar el orden de declaración de los hooks.
  useLayoutEffect(() => {
    videoElRef.current = playerRef.current?.video() ?? null;
  }, [channel.id]);

  /**
   * Pantalla completa DE VERDAD, no solo el CSS `absolute inset-0` de este
   * componente. Antes el botón "Salir de pantalla completa" solo volvía a la
   * vista de navegación del SPA — nunca llamaba a la Fullscreen API del
   * navegador — así que en una TV el vídeo se veía grande pero el marco del
   * navegador seguía encima. `toggleFullscreen` sí pide el modo real, con
   * respaldo a `documentElement` cuando el contenedor lo rechaza.
   */
  const { isFullscreen, toggleFullscreen } = useFullscreen(containerRef, videoElRef);

  // Transmitir a una TV desde el teléfono. `videoElRef` es el mismo <video>
  // real que usa la pantalla completa: da igual cuál de los dos consuma el
  // elemento primero, ambos leen `.current` en el momento de actuar.
  const { canCast, isCasting, startCasting, stopCasting, castError, dismissCastError } =
    useCast(videoElRef, channel.streamUrl, channel.name);

  const [showParty, setShowParty] = useState(false);
  const [roomInput, setRoomInput] = useState("");
  const [activeRoom, setActiveRoom] = useState("");
  const watchParty = useWatchParty(videoElRef, activeRoom || undefined);

  const [showControls, setShowControls] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [state, setState] = useState<StreamPlayerState>({
    isPlaying: true,
    isMuted: false,
    streamError: false,
    needsUserGesture: false,
  });


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
    // Reinicia la visibilidad de controles y su temporizador cada vez que
    // cambia el canal sintonizado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    "grid h-[58px] w-[58px] shrink-0 place-items-center rounded-2xl border border-white/12 bg-white/12 text-accent backdrop-blur-md";

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 bg-black"
      onMouseMove={wake}
      // Doble clic o doble toque: pantalla completa real, como en cualquier
      // reproductor de escritorio.
      onDoubleClick={toggleFullscreen}
    >
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
        <div className="scroll-none flex min-w-0 items-center gap-2.5 overflow-x-auto">
          <button
            type="button"
            data-nav="button"
            aria-label={state.isPlaying ? "Pausar" : "Reproducir"}
            onClick={() => {
              playerRef.current?.togglePlay();
              wake();
            }}
            className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-2xl bg-accent text-accent-on"
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

          {/* Cambiar de canal es lo que más se hace viendo la tele, así que
              tiene botón propio. Marcar un favorito no: eso se hace desde la
              lista, con la parrilla delante y sin tapar el vídeo. */}
          <button
            type="button"
            data-nav="button"
            aria-label="Canal siguiente"
            onClick={() => zap(1)}
            className={controlClass}
          >
            <SkipForward aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
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
            aria-label="Ver en familia"
            aria-expanded={showParty}
            onClick={() => setShowParty((value) => !value)}
            className={controlClass}
          >
            <Users aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
          </button>

          {canCast && (
            <button
              type="button"
              data-nav="button"
              aria-label={isCasting ? "Dejar de transmitir a la TV" : "Transmitir a la TV"}
              aria-pressed={isCasting}
              onClick={isCasting ? stopCasting : startCasting}
              className={`${controlClass} ${isCasting ? "text-live" : ""}`}
            >
              <Cast aria-hidden="true" strokeWidth={1.5} className="h-5 w-5" />
            </button>
          )}

          <button
            type="button"
            data-nav="button"
            /* Un único botón para salir.
               Antes había dos y se confundían: uno pedía pantalla completa real
               al navegador y el otro devolvía a la navegación. Como ahora se
               entra aquí desde el reproductor pequeño de Inicio, "pantalla
               completa" es un solo estado y este botón lo deshace entero: cierra
               la pantalla completa del navegador si estaba activa y vuelve. El
               doble clic sigue alternando la del navegador, como en cualquier
               reproductor de escritorio. */
            aria-label="Salir de pantalla completa"
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              onExit();
            }}
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

      {/* Aviso de fallo al transmitir. Antes solo se veía en la consola del
          navegador, así que desde fuera parecía que el botón no hacía nada. */}
      {castError && (
        <div className="tv-safe absolute inset-x-0 top-24 z-30 flex items-start gap-2.5 rounded-2xl border border-white/12 bg-app/92 p-4 text-sm backdrop-blur-xl">
          <Cast aria-hidden="true" strokeWidth={1.5} className="mt-0.5 h-4 w-4 shrink-0 text-live" />
          <p className="flex-1 text-zinc-100/85">{castError}</p>
          <button
            type="button"
            data-nav="button"
            onClick={dismissCastError}
            aria-label="Cerrar aviso"
            className="shrink-0 rounded-lg px-2 text-zinc-100/50 hover:text-accent"
          >
            ✕
          </button>
        </div>
      )}

      {/* Ver en familia: sala de Pusher, sincroniza play/pause/seek entre
          quien la abra con el mismo nombre. */}
      {showParty && (
        <div className="tv-safe absolute inset-x-0 top-24 z-30 w-full max-w-sm rounded-2xl border border-white/12 bg-app/92 p-4 backdrop-blur-xl sm:right-6 sm:left-auto">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setActiveRoom(normalizeRoomId(roomInput));
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor="watch-party-room" className="text-sm font-semibold">
              Ver en familia
            </label>
            <div className="flex gap-2">
              <input
                id="watch-party-room"
                data-nav="input"
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value)}
                placeholder="nombre de la sala"
                className="min-w-0 flex-1 rounded-xl border border-white/12 bg-surface-2 px-3.5 py-2.5 text-sm placeholder-zinc-100/35 outline-none focus:border-accent"
              />
              <button
                type="submit"
                data-nav="button"
                className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-on"
              >
                {activeRoom ? "Cambiar" : "Entrar"}
              </button>
            </div>
            <p className="text-[13px] text-zinc-100/50">
              {watchParty.status === "connected"
                ? "Conectado: quien abra la misma sala verá esto sincronizado."
                : watchParty.status === "connecting"
                  ? "Conectando…"
                  : watchParty.status === "error"
                    ? "No se pudo conectar la sala."
                    : "Quien abra esta misma sala verá el canal sincronizado."}
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
