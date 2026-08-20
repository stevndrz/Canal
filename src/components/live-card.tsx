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

  const expandir = useCallback(() => onExpand(channel), [onExpand, channel]);

  // Enter y OK del mando abren la pantalla completa. Sin esto, con un mando la
  // tarjeta se puede enfocar pero no se puede hacer nada con ella.
  const alPulsarTecla = (evento: React.KeyboardEvent) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      expandir();
    }
  };

  return (
    <section className="live-card" aria-label={`En directo: ${channel.name}`}>
      <div
        className="live-card-marco"
        role="button"
        tabIndex={0}
        data-nav="tile"
        onDoubleClick={expandir}
        onKeyDown={alPulsarTecla}
        aria-label={`Ver ${channel.name} en pantalla completa`}
      >
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
