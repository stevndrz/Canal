"use client";

import { useCallback, useRef, useState } from "react";
import { Maximize, SkipForward, Volume2, VolumeX } from "lucide-react";
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
  /** Cambiar al canal siguiente sin salir de Inicio. */
  onNext: () => void;
}

export function LiveCard({ channel, settings, onExpand, onNext }: LiveCardProps) {
  const playerRef = useRef<StreamPlayerHandle | null>(null);
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
    document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
    onExpand(channel);
  }, [onExpand, channel]);

  return (
    <section className="live-card" aria-label={`En directo: ${channel.name}`}>
      {/* Sin `role="button"` ni `aria-label`: los tenía y repetían palabra por
          palabra los del botón "Pantalla completa" de abajo, así que un lector
          de pantalla anunciaba dos veces el mismo mando. El doble clic se queda
          porque es lo que espera cualquiera que venga de un reproductor de
          escritorio; con mando y con el dedo está el botón. */}
      <div className="live-card-marco" onDoubleClick={expandir}>
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

      <div className="live-card-controles">
        <button
          type="button"
          data-nav="button"
          className="live-card-boton"
          aria-label={state.isMuted ? "Activar sonido" : "Silenciar"}
          aria-pressed={state.isMuted}
          onClick={() => playerRef.current?.toggleMute()}
        >
          {state.isMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          <span>{state.isMuted ? "Sonido" : "Silenciar"}</span>
        </button>

        <button
          type="button"
          data-nav="button"
          className="live-card-boton"
          aria-label="Canal siguiente"
          onClick={onNext}
        >
          <SkipForward size={19} />
          <span>Siguiente</span>
        </button>

        <button
          type="button"
          data-nav="button"
          className="live-card-boton is-primary"
          aria-label={`Ver ${channel.name} en pantalla completa`}
          onClick={expandir}
        >
          <Maximize size={19} />
          <span>Pantalla completa</span>
        </button>
      </div>
    </section>
  );
}

/** Marcador del mismo tamaño mientras carga el reproductor. Evita el salto. */
export function LiveCardSkeleton() {
  return (
    <section className="live-card" aria-hidden="true">
      <div className="live-card-marco is-cargando" />
      <div className="live-card-controles" />
    </section>
  );
}
