"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ICONO_CAST, PlayerControls } from "@/components/player/player-controls";
import { useCast } from "@/hooks/use-cast";
import type { Channel, PlaybackSettings } from "@/lib/types";
import StreamPlayer, {
  type StreamPlayerHandle,
  type StreamPlayerState,
} from "@/components/stream-player";

/**
 * El canal en directo dentro de Inicio.
 *
 * Es la pieza que hace que la app se abra viendo la tele en vez de en una
 * parrilla: al llegar ya hay señal, y la pantalla completa es una decisión de
 * la persona, no la puerta de entrada.
 *
 * Comparte `StreamPlayer` con el reproductor grande, así que la lógica de
 * HLS, MPEG-TS y reintentos es exactamente la misma en los dos sitios. Lo que
 * cambia es el chrome: aquí lo mínimo para saber qué se está viendo, y allí
 * los controles completos.
 *
 * Los dos nunca están montados a la vez —el shell cambia de vista— y eso
 * importa: dos reproductores con el mismo canal serían el doble de ancho de
 * banda y dos audios encima.
 *
 * Aquí no va el reloj: la barra de navegación lo enseña a dos centímetros. En
 * pantalla completa sí, porque allí la barra no está.
 */
interface LiveCardProps {
  channel: Channel;
  settings: PlaybackSettings;
  /** Pasar a pantalla completa con este canal. */
  onExpand: (channel: Channel) => void;
  /** Cambiar de canal sin salir de Inicio. */
  onNext: () => void;
  onPrev: () => void;
}

export function LiveCard({ channel, settings, onExpand, onNext, onPrev }: LiveCardProps) {
  const playerRef = useRef<StreamPlayerHandle | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<StreamPlayerState>({
    isPlaying: true,
    isMuted: true,
    streamError: false,
    needsUserGesture: false,
  });

  /**
   * Pantalla completa de verdad, en un solo gesto.
   *
   * Antes esto solo cambiaba de vista: el reproductor ocupaba la ventana pero
   * el navegador seguía enseñando su barra de direcciones y sus pestañas, así
   * que había que dar además un doble clic para completarla. Dos pasos para una
   * sola intención.
   *
   * `requestFullscreen` **solo funciona dentro de un gesto de la persona**, así
   * que se pide aquí mismo y no después de cambiar de vista. Se pide sobre el
   * documento entero porque el contenedor del reproductor todavía no existe en
   * este instante: se monta justo después.
   *
   * Safari en iPhone no implementa la API sobre elementos que no sean `<video>`
   * —ahí `requestFullscreen` ni existe—, así que el `catch` y el `?.` no son
   * decorativos: en iPhone se queda en la vista inmersiva, que es todo lo que
   * ese sistema permite sin abrir su reproductor nativo.
   */
  const expandir = useCallback(() => {
    pedirPantallaCompleta(playerRef.current?.video() ?? null);
    onExpand(channel);
  }, [onExpand, channel]);

  // El vídeo real vive dentro de StreamPlayer y se expone por método; Cast lo
  // necesita como ref, así que se copia en cuanto existe.
  useEffect(() => {
    videoRef.current = playerRef.current?.video() ?? null;
  }, [channel.streamUrl]);

  const { canCast, isCasting, startCasting, stopCasting, castError, dismissCastError } = useCast(
    videoRef,
    channel.streamUrl,
    channel.name,
  );

  return (
    <section className="live-card" aria-label={`En directo: ${channel.name}`}>
      {/* Sin `role="button"` ni `aria-label`: los tenía y repetían palabra por
          palabra los del botón "Pantalla completa" de abajo, así que un lector
          de pantalla anunciaba dos veces el mismo mando. El doble clic se queda
          porque es lo que espera cualquiera que venga de un reproductor de
          escritorio; con mando y con el dedo está el botón. */}
      <div className="live-card-marco">
        <div className="live-card-video" onDoubleClick={expandir}>
          <StreamPlayer
            ref={playerRef}
            channel={channel}
            settings={settings}
            onStateChange={setState}
          />

          <div className="live-card-top">
          <span className="live-card-vivo">
            <span className="live-dot" />
            EN VIVO
          </span>
          <strong className="live-card-nombre">{channel.name}</strong>
            <span className="live-card-meta">
              {channel.number} · {channel.category}
            </span>
          </div>

          {state.streamError && (
            <div className="live-card-aviso">
              <p>Este canal no está respondiendo.</p>
              <button type="button" data-nav="button" onClick={() => playerRef.current?.retry()}>
                Reintentar
              </button>
            </div>
          )}
        </div>

        {/* Dentro del marco, no fuera.
            En escritorio la barra se posiciona **encima del vídeo**, en el
            borde inferior, que es como se ve un reproductor y no un mando
            suelto debajo de una imagen. En teléfono se queda debajo, en el
            flujo: ahí la pantalla es estrecha, tapar el vídeo con una barra
            cuesta caro, y además esa disposición —imagen arriba, botones
            grandes abajo— es la que hace que se lea como un mando para pasar
            el canal a la tele, que es justo lo que se quería. */}
        <PlayerControls
        variant="embedded"
        isPlaying={state.isPlaying}
        isMuted={state.isMuted}
        onTogglePlay={() => playerRef.current?.togglePlay()}
        onToggleMute={() => playerRef.current?.toggleMute()}
        onPrev={onPrev}
        onNext={onNext}
        fullscreen={{ active: false, onToggle: expandir }}
        big={settings.bigControls}
        extras={
          canCast
            ? [
                {
                  id: "cast",
                  label: isCasting ? "Dejar de transmitir" : "Enviar a la TV",
                  icon: ICONO_CAST,
                  active: isCasting,
                  pressed: isCasting,
                  onClick: isCasting ? stopCasting : startCasting,
                },
              ]
            : []
          }
        />
      </div>

      {castError && (
        <p className="live-card-error" role="status">
          {castError}
          <button type="button" data-nav="button" onClick={dismissCastError} aria-label="Cerrar aviso">
            ✕
          </button>
        </p>
      )}
    </section>
  );
}

/** Marcador del mismo tamaño mientras carga el reproductor. Evita el salto. */
export function LiveCardSkeleton() {
  return (
    <section className="live-card" aria-hidden="true">
      <div className="live-card-marco">
        <div className="live-card-video is-cargando" />
      </div>
    </section>
  );
}

/**
 * Pantalla completa de verdad, probando lo que cada sistema permite.
 *
 * En orden: la API estándar sobre el documento; la variante WebKit; y por
 * último `webkitEnterFullscreen()` sobre el propio `<video>`.
 *
 * Ese último paso es el que importa en un iPhone. Safari en iPhone **no
 * implementa la Fullscreen API sobre nada que no sea un `<video>`**: en una
 * pestaña normal, `requestFullscreen` ni existe, y por eso la barra de
 * direcciones seguía encima aunque el reproductor ocupara la ventana. La única
 * forma de que un iPhone entregue la pantalla entera es el reproductor nativo
 * del sistema, que además trae AirPlay incorporado.
 *
 * El precio: en iPhone se ven los controles de Apple y no los nuestros. La otra
 * vía —conservar nuestro diseño y ganar la pantalla completa— es añadir la app
 * a la pantalla de inicio, que la abre sin nada de Safari alrededor.
 */
function pedirPantallaCompleta(video: HTMLVideoElement | null) {
  const raiz = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  if (typeof raiz.requestFullscreen === "function") {
    void raiz.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
    return;
  }
  if (typeof raiz.webkitRequestFullscreen === "function") {
    void raiz.webkitRequestFullscreen();
    return;
  }
  const nativo = video as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
  nativo?.webkitEnterFullscreen?.();
}
