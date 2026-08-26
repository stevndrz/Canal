"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Cast } from "lucide-react";
import {
  extrasCast,
  ICONO_GUIA,
  PlayerControls,
} from "@/components/player/player-controls";
import { PanelEmision } from "@/components/player/panel-emision";
import type { EstadoEmision } from "@/lib/telemetria";
import type { Channel, PlaybackSettings } from "@/lib/types";
import StreamPlayer, {
  type StreamPlayerHandle,
  type StreamPlayerState,
} from "@/components/stream-player";
import { stepChannel } from "@/lib/channels";
import { esToqueEnElVideo } from "@/lib/toque-en-el-video";
import { GuiaCanales } from "@/components/player/guia-canales";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useReloj } from "@/hooks/use-reloj";
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
  /** La persona ha tocado el botón de sonido. Ver `recordarSilencio`. */
  onSilencio?: (mudo: boolean) => void;
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
  onSilencio,
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

  /**
   * El reloj vive AQUÍ, que es el único sitio donde se pinta.
   *
   * Estaba en `Dashboard` y bajaba como prop. `useReloj` cambia cada 20
   * segundos, así que **re-renderizaba el árbol entero de la aplicación** —
   * hasta unas 200 tarjetas en Inicio— para actualizar un dato que en esa
   * vista no lee nadie. En una tele vieja ese era el tirón periódico al
   * navegar con el mando. `TopNav` ya tenía el suyo aislado de la misma
   * manera.
   */
  const clock = useReloj();

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


  /**
   * Desde cuándo se está en ESTE canal.
   *
   * Se marca al montar y en cada zapeo, no al empezar a reproducir: lo que se
   * cuenta es el rato que llevas viendo el canal, y una recarga del stream a
   * mitad de un partido no lo reinicia.
   *
   * El reloj de pared es un sistema externo, así que leerlo es trabajo de un
   * efecto y no del render —de ahí la excepción de abajo, que es la misma que
   * ya usa `wake()` unas líneas más allá—. El precio es un render de más al
   * zapear, en el que el contador enseña un instante el tiempo del canal
   * anterior; a un segundo de resolución no se ve.
   */
  // `undefined` hasta que el efecto la fije: sin marca no hay módulo, que es
  // justo lo que hace `modulosDeEmision` con un dato ausente. Un cero aquí
  // sacaría un «T+ 490.000:00:00» en el primer fotograma.
  const [desde, setDesde] = useState<number | undefined>(undefined);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDesde(Date.now());
  }, [channel.id]);

  /**
   * En qué está la emisión, dicho sin inventar nada.
   *
   * `sintonizando` no es un adorno: mientras el `<video>` no tenga altura no ha
   * llegado ni un fotograma, así que decir «EN VIVO» sobre una pantalla negra
   * sería mentir justo cuando la persona está mirando a ver si funciona.
   */
  const estado: EstadoEmision = state.streamError
    ? "sin-senal"
    : !state.isPlaying
      ? "pausa"
      : state.alto
        ? "vivo"
        : "sintonizando";

  const lectura = useMemo(
    () => ({ ancho: state.ancho, alto: state.alto, bitrate: state.bitrate, desde }),
    [state.ancho, state.alto, state.bitrate, desde],
  );

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

  /** Tocar la imagen pausa y reanuda, y despierta la barra. */
  const alTocar = useCallback(
    (evento: React.MouseEvent) => {
      if (!esToqueEnElVideo(evento.target)) return;
      playerRef.current?.togglePlay();
      wake();
    },
    [wake],
  );

  /**
   * Recorrer la barra de controles con el mando.
   *
   * Es lo que faltaba para que esta pantalla se pudiera usar con un mando de
   * verdad: `use-spatial-nav` está apagado en el reproductor —a propósito, las
   * flechas aquí zapean— así que **no había ninguna forma de llegar a la
   * barra**. Los botones existían y con el mando eran inalcanzables; solo
   * servían con ratón o con el dedo.
   *
   * La primera pulsación entra por el primer botón (Pausar) en vez de por
   * donde caiga el orden del DOM.
   */
  const moverFoco = useCallback(
    (delta: number) => {
      wake();
      const barra = containerRef.current?.querySelector(".player-bar");
      const botones = barra ? [...barra.querySelectorAll<HTMLElement>("[data-nav]")] : [];
      if (botones.length === 0) return;
      const actual = botones.indexOf(document.activeElement as HTMLElement);
      botones[actual === -1 ? 0 : (actual + delta + botones.length) % botones.length].focus();
    },
    [wake],
  );

  /**
   * El mando manda:
   *
   *   ↑ ↓        cambiar de canal
   *   ← →        recorrer la barra de controles
   *   OK         pulsar el botón enfocado; si no hay ninguno, abrir la guía
   *   ⏯ ⏵ ⏸      reproducir o pausar
   *   Atrás      salir
   *
   * ← y → zapeaban, que era repetir lo que ya hacían ↑ y ↓ y dejaba la barra
   * sin ninguna tecla que la alcanzara. Y las teclas de reproducción del mando
   * —que Tizen y webOS sí mandan— no estaban: pausar solo se podía con la
   * barra espaciadora o con «k», que en un mando de televisor no existen.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const enLaBarra = (document.activeElement as HTMLElement | null)?.closest(".player-bar");

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          zap(-1);
          return;
        case "ArrowDown":
          event.preventDefault();
          zap(1);
          return;
        /**
         * ← y → dependen de si la guía está abierta.
         *
         * Con la guía delante, recorren canales: es lo que dice su propia
         * pista («← → recorrer · OK sintonizar») y lo que hace que la tira de
         * canales se mueva. Sin ella, llevan el foco por la barra de
         * controles, que es lo único que no tenía forma de alcanzarse con un
         * mando.
         */
        case "ArrowLeft":
          event.preventDefault();
          if (showGuide) zap(-1);
          else moverFoco(-1);
          return;
        case "ArrowRight":
          event.preventDefault();
          if (showGuide) zap(1);
          else moverFoco(1);
          return;
        case "Enter":
          // Con un botón enfocado, el navegador ya lo pulsa solo: interceptar
          // aquí sería robarle el OK al control que la persona acaba de elegir.
          if (enLaBarra) return;
          event.preventDefault();
          if (showGuide) setShowGuide(false);
          else openGuide();
          return;
        case "MediaPlayPause":
        case "MediaPlay":
        case "MediaPause":
        case "MediaStop":
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
  }, [zap, showGuide, openGuide, wake, moverFoco]);

  /**
   * Al esconderse la barra, soltar el foco.
   *
   * Si no, queda enfocado un botón invisible: la siguiente pulsación de OK
   * activaría algo que no se está viendo, y la de ← o → seguiría recorriendo
   * una barra que ya no está.
   */
  useEffect(() => {
    if (showControls) return;
    const activo = document.activeElement as HTMLElement | null;
    if (activo?.closest(".player-bar")) activo.blur();
  }, [showControls]);


  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 bg-black"
      onMouseMove={wake}
      /* Tocar la imagen pausa y reanuda; el doble toque va a pantalla completa
         real. Sin temporizador a propósito: el segundo clic deshace el primero
         y todo queda como estaba antes de expandir. Ver `live-card.tsx`. */
      onClick={alTocar}
      onDoubleClick={toggleFullscreen}
    >
      <StreamPlayer
        ref={playerRef}
        channel={channel}
        settings={settings}
        onStateChange={setState}
      />

      {/* Cabecera: el panel de la emisión. Ver `panel-emision.tsx`. */}
      <div
        className={`tv-safe pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/78 to-transparent py-7 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <PanelEmision
          channel={channel}
          estado={estado}
          lectura={lectura}
          reloj={clock}
          activo={showControls}
        />
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
            onSilencio?.(!state.isMuted);
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

        {/* La pista cambia con el contexto, porque las teclas cambian: con la
            guía abierta ← → recorren canales, y sin ella llevan el foco por
            esta misma barra. Una chuleta que miente es peor que ninguna. */}
        <div className="absolute right-[3.35vw] hidden items-center gap-5 text-[13px] text-soft xl:flex">
          <span>↑↓ cambiar canal</span>
          <span>{showGuide ? "← → recorrer" : "← → controles"}</span>
          <span>{showGuide ? "OK sintonizar" : "OK guía"}</span>
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
          <p className="flex-1 text-muted">{castError}</p>
          <button
            type="button"
            data-nav="button"
            onClick={dismissCastError}
            aria-label="Cerrar aviso"
            className="shrink-0 rounded-lg px-2 text-soft hover:text-accent"
          >
            ✕
          </button>
        </div>
      )}

    </div>
  );
}
