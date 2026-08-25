"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Cast } from "lucide-react";
import {
  extrasCast,
  ICONO_GUIA,
  PlayerControls,
} from "@/components/player/player-controls";
import type { Channel, PlaybackSettings } from "@/lib/types";
import StreamPlayer, {
  type StreamPlayerHandle,
  type StreamPlayerState,
} from "@/components/stream-player";
import { stepChannel } from "@/lib/channels";
import { GuiaCanales } from "@/components/player/guia-canales";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useCast } from "@/hooks/use-cast";

interface FullscreenPlayerProps {
  channel: Channel;
  /**
 * Una emisión en directo no se pausa ni se busca, así que aquí no hay barra de
 * progreso ni controles de tiempo: zapear es el único movimiento posible.
 */
/** Lista visible: define qué zapea ↑↓ y qué muestra la guía. */
  playlist: Channel[];
  settings: PlaybackSettings;
  onTune: (channel: Channel) => void;
  onExit: () => void;
  clock: string;
}

/* Cinco segundos, no cuatro. El tiempo que tarda alguien que no conoce los
   iconos en decidir cuál pulsar es más largo que el de quien ya los reconoce, y
   que la barra se vaya mientras dudas es justo lo que la hace sentir hostil.
   Solo aplica en pantalla completa: el reproductor de Inicio lleva sus
   controles debajo del vídeo, donde no tapan nada, y no los oculta nunca. */
const CONTROLS_TIMEOUT = 5000;
const GUIDE_TIMEOUT = 5000;

export function FullscreenPlayer({
  channel,
  playlist,
  settings,
  onTune,
  onExit,
  clock,
}: FullscreenPlayerProps) {
  const playerRef = useRef<StreamPlayerHandle | null>(null);
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  // El <video> real vive dentro de StreamPlayer y se expone por método
  // imperativo, no por ref directa: `videoElRef.current` hay que copiarlo a
  // mano en vez de que React lo rellene solo al montar. Tiene que ser
  // `useLayoutEffect`, no `useEffect`: los hooks de abajo (useCast)
  // leen `videoElRef.current` en SU PROPIO useEffect, que se
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
  const { toggleFullscreen } = useFullscreen(containerRef, videoElRef);

  // Transmitir a una TV desde el teléfono. `videoElRef` es el mismo <video>
  // real que usa la pantalla completa: da igual cuál de los dos consuma el
  // elemento primero, ambos leen `.current` en el momento de actuar.
  const { castMethod, isCasting, startCasting, stopCasting, castError, dismissCastError } =
    useCast(videoElRef, channel.streamUrl, channel.name);


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
        /* `justify-center`: la barra va centrada. Con `justify-between` se
           quedaba pegada a la izquierda y las ayudas de teclado a la derecha,
           que en un teléfono girado se veía descolocado. Las ayudas pasan a
           estar posicionadas y no compiten por el espacio. */
        className={`tv-safe absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-6 bg-gradient-to-t from-black/85 to-transparent py-7 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <PlayerControls
          variant="fullscreen"
          isPlaying={state.isPlaying}
          isMuted={state.isMuted}
          big={settings.bigControls}
          onTogglePlay={() => {
            playerRef.current?.togglePlay();
            wake();
          }}
          onToggleMute={() => {
            playerRef.current?.toggleMute();
            wake();
          }}
          onPrev={() => zap(-1)}
          onNext={() => zap(1)}
          fullscreen={{
            active: true,
            onToggle: () => {
              // Deshace el estado entero: la pantalla completa del navegador,
              // si se concedió, y la vista inmersiva. Salir a medias dejaba al
              // navegador en fullscreen enseñando la navegación por debajo.
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              onExit();
            },
          }}
          extras={[
            {
              id: "guia",
              label: "Guía",
              icon: ICONO_GUIA,
              expanded: showGuide,
              onClick: () => (showGuide ? setShowGuide(false) : openGuide()),
            },
            ...extrasCast({ metodo: castMethod, isCasting, startCasting, stopCasting }),
          ]}
        />

        <div className="absolute right-[3.35vw] hidden items-center gap-5 text-[13px] text-zinc-100/50 xl:flex">
          <span>↑↓ cambiar canal</span>
          <span>OK guía</span>
          <span>Atrás salir</span>
        </div>
      </div>

      {/* Guía: la cuadrícula vuelve como overlay translúcido, sin salir del vivo */}
      {showGuide && (
        <GuiaCanales
          playlist={playlist}
          channelId={channel.id}
          onTune={(canal) => {
            onTune(canal);
            openGuide();
          }}
        />
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

    </div>
  );
}
