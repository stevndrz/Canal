"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Cast } from "lucide-react";
import { extrasCast, ICONO_GUIA } from "@/components/player/player-controls";
import { ControlesVivo } from "@/components/player/controles-vivo";
import { estadoDeEmision } from "@/components/player/info-vivo";
import type { Channel, PlaybackSettings } from "@/lib/types";
import StreamPlayer, {
  type StreamPlayerHandle,
  type StreamPlayerState,
} from "@/components/stream-player";
import { stepChannel } from "@/lib/channels";
import { esToqueEnElVideo } from "@/lib/toque-en-el-video";
import { accionDeTecla } from "@/lib/teclas-mando";
import { GuiaCanales } from "@/components/player/guia-canales";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { esTeclaAtras } from "@/hooks/use-spatial-nav";
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

/* Cinco segundos, no cuatro: que la barra se vaya mientras dudas qué icono
   pulsar es lo que la hace sentir hostil. Solo en pantalla completa — los
   controles de Inicio van debajo del vídeo y no se ocultan nunca. */
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


  const estado = estadoDeEmision(state);

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

  /**
   * Cambiar de canal enseña el rótulo —logo, nombre, programa—, no la guía.
   *
   * Antes cada ↑/↓ abría la tira de cincuenta canales por encima de la imagen,
   * y como el reloj de la guía se reiniciaba en cada pulsación, zapear era ver
   * la pantalla saltar sin parar. Es lo que hace cualquier tele de pago: al
   * cambiar sale quién es, y la lista solo si la pides (OK o el botón Guía).
   * Si la guía ya estaba abierta, se queda y sigue al canal.
   */
  const zap = useCallback(
    (delta: number) => {
      const next = stepChannel(playlist, channel.id, delta);
      if (!next) return;
      onTune(next);
      if (showGuide) openGuide();
      wake();
    },
    [playlist, channel.id, onTune, openGuide, wake, showGuide],
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
   * Recorrer la barra de controles con el mando. `use-spatial-nav` está apagado
   * aquí a propósito —las flechas zapean—, así que **no había forma de llegar a
   * la barra**: los botones existían y solo servían con ratón o con el dedo.
   * La primera pulsación entra por Pausar, no por donde caiga el DOM.
   */
  const moverFoco = useCallback(
    (delta: number) => {
      wake();
      const barra = containerRef.current?.querySelector(".player-bar");
      const botones = barra ? [...barra.querySelectorAll<HTMLElement>("[data-nav]")] : [];
      if (botones.length === 0) return;
      const actual = botones.indexOf(document.activeElement as HTMLElement);
      if (actual === -1) {
        // La primera pulsación cae en Pausar, el control que se busca a ciegas.
        (barra?.querySelector<HTMLElement>(".is-primary") ?? botones[0]).focus();
        return;
      }
      botones[(actual + delta + botones.length) % botones.length].focus();
    },
    [wake],
  );

  /**
   * Deshace el estado entero: la pantalla completa del navegador, si se
   * concedió, y la vista inmersiva. Salir a medias dejaba al navegador en
   * fullscreen enseñando la navegación por debajo.
   *
   * Un solo sitio para el botón «Salir» de la barra Y la tecla Atrás: antes
   * solo el botón lo hacía —la pista en pantalla decía «Atrás salir» y era
   * mentira, esa tecla no hacía nada—.
   */
  const salir = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    onExit();
  }, [onExit]);

  /**
   * El mando manda:
   *
   *   ↑ ↓        cambiar de canal
   *   ← →        recorrer la barra de controles
   *   OK         pulsar el botón enfocado; si no hay ninguno, abrir la guía
   *   ⏯ ⏵ ⏸      reproducir o pausar
   *   Atrás      salir
   *
   * ← y → zapeaban, repitiendo lo de ↑ y ↓ y dejando la barra inalcanzable. Y
   * faltaban las teclas de reproducción que Tizen y webOS sí mandan: pausar
   * pedía espacio o «k», que en un mando no existen.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Atrás se mira ANTES que nada, con nombre Y con código: Tizen la manda
      // como 10009 y no como "Escape", y `event.key` por sí solo no la
      // habría reconocido nunca. Ver `esTeclaAtras`.
      //
      // Con la guía abierta, Atrás la cierra a ELLA primero y no sale de
      // pantalla completa: mientras se ve la guía, arriba/abajo zapea e
      // izquierda/derecha recorre canales, así que no queda NINGUNA tecla
      // libre para decir «esto no, quiero volver a los controles de abajo».
      // Antes solo se podía esperar 5 segundos a que se cerrara sola
      // (`GUIDE_TIMEOUT`), y cada flecha pulsada mientras tanto reiniciaba
      // ese reloj — encontrado probando en una tele real, se sentía como que
      // el mando dejaba de responder.
      if (esTeclaAtras(event)) {
        event.preventDefault();
        // `stopPropagation` es obligatorio, no adorno: `useSpatialNav`
        // (`dashboard.tsx`) escucha Atrás EN LA VENTANA TAMBIÉN, y a
        // propósito no lo apaga `enabled` — es lo que saca del reproductor
        // si este manejador nunca llegara a montarse. Sin cortarla aquí, las
        // dos rutas oían la MISMA pulsación: esta cerraba la guía, pero la de
        // `dashboard.tsx` no sabe nada de guías, veía `view === "player"` y
        // salía de pantalla completa igual — la persona nunca llegaba a ver
        // que la guía se había cerrado, porque ya estaba en Inicio. Mismo
        // patrón que ya usa `ficha-reproductor.tsx` para su propio Atrás.
        event.stopPropagation();
        if (showGuide) {
          setShowGuide(false);
          return;
        }
        salir();
        return;
      }

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
         * ← y → dependen de si la guía está abierta: con ella recorren canales
         * —lo que dice su propia pista—, y sin ella llevan el foco por la barra
         * de controles, que es lo que no se podía alcanzar de otra forma.
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
          break;
      }

      /**
       * Las teclas del mando que llegan SIN nombre.
       *
       * Va DESPUÉS del `switch` de arriba y no dentro: en Tizen 4 y 5
       * `event.key` viene "Unidentified" para reproducir/pausar/parar y para
       * los botones de canal, así que ningún `case` por nombre las habría
       * alcanzado. Ver `teclas-mando.ts` para la tabla de códigos.
       */
      switch (accionDeTecla(event)) {
        // Parar hace lo mismo que pausar, a propósito: esto es una emisión en
        // directo y no un archivo con principio, así que detenerla del todo
        // dejaría un rectángulo negro sin ninguna forma de recuperarlo con
        // el mando.
        case "reproducir":
        case "parar":
          event.preventDefault();
          playerRef.current?.togglePlay();
          wake();
          return;
        // Los botones de canal del mando hacen lo mismo que ↑ y ↓: es lo que
        // dice el dibujo de la tecla, y no tiene sentido que zapeen distinto.
        case "canal-arriba":
          event.preventDefault();
          zap(-1);
          return;
        case "canal-abajo":
          event.preventDefault();
          zap(1);
          return;
        default:
          wake();
      }
    };

    // Fase de CAPTURA: tiene que oír Atrás antes que `useSpatialNav`
    // (`dashboard.tsx`), que también escucha en la ventana y no se apaga
    // para esta tecla. En fase de burbuja el orden depende de quién se montó
    // primero —Dashboard siempre gana, está montado desde el principio—; en
    // captura, este listener corre primero sí o sí, sin importar el orden de
    // montaje.
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [zap, showGuide, openGuide, wake, moverFoco, salir]);

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
      /* `con-controles`: mientras se ven, la píldora del rótulo ya dice
         «Conectando», y el aviso central de `StreamPlayer` se quita para no
         quedar debajo del botón de pausa. */
      className={`reproductor-completo absolute inset-0 z-20 bg-black ${
        showControls ? "con-controles" : ""
      }`}
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

      {/* Velo: oscurece arriba y abajo para que los controles se lean sobre
          cualquier escena. Sin `backdrop-filter`: desenfocar un vídeo en
          directo es lo más caro que se le puede pedir a la GPU de una tele. */}
      <div
        className={`vivo-velo ${showControls ? "is-visible" : ""}`}
        aria-hidden="true"
      />

      <ControlesVivo
        channel={channel}
        estado={estado}
        visible={showControls}
        guiaAbierta={showGuide}
        isPlaying={state.isPlaying}
        isMuted={state.isMuted}
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
        onSalir={salir}
        extras={[
          {
            id: "guia",
            label: showGuide ? "Cerrar guía" : "Guía de canales",
            icon: ICONO_GUIA,
            expanded: showGuide,
            onClick: () => (showGuide ? setShowGuide(false) : openGuide()),
          },
          ...extrasCast({ metodo: castMethod, isCasting, startCasting, stopCasting }),
        ]}
      />

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
