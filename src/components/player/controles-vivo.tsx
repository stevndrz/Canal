"use client";

import { ChevronLeft, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import type { PlayerAction } from "@/components/player/player-controls";
import { BarraPrograma, InfoVivo } from "@/components/player/info-vivo";
import type { EstadoEmision } from "@/lib/telemetria";
import type { Channel } from "@/lib/types";

/**
 * La capa de pantalla completa: el reproductor de vídeo de iPhone y Apple TV,
 * que es el que ya sabe usar todo el mundo.
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ ‹ Salir                       🔇  ☰  ⎚       │   lo que cambia de modo
 *   │                                              │
 *   │              ⏮     ⏯     ⏭                   │   el dial, en el centro
 *   │                                              │
 *   │ [logo] ● EN VIVO  102 · Guatemala            │
 *   │        Canal 7                               │   el rótulo
 *   │        Noticiero          20:00 ━━━━── 21:00 │
 *   └──────────────────────────────────────────────┘
 *
 * Antes todo iba en una sola fila abajo —transporte, sonido, guía, cast,
 * «Salir» y una chuleta de teclas— y la cabecera repetía el estado en
 * versalitas tecleadas arriba. Era mucho que leer para lo que se hace casi
 * siempre, que es mirar y, de vez en cuando, pausar o cambiar de canal.
 *
 * **Orden del DOM ≠ orden visual, a propósito.** ← y → recorren los botones en
 * el orden del documento (`moverFoco` en `fullscreen-player.tsx`), así que el
 * dial va primero: desde Pausar, la flecha derecha lleva a «siguiente» y no a
 * «Salir». La rejilla los pone luego en su sitio.
 *
 * La raíz no recibe toques (`pointer-events: none`): solo los botones. Así un
 * toque en la imagen sigue llegando al vídeo y pausa, que es lo que mira
 * `esToqueEnElVideo`.
 */
export function ControlesVivo({
  channel,
  estado,
  visible,
  guiaAbierta,
  isPlaying,
  isMuted,
  onTogglePlay,
  onToggleMute,
  onPrev,
  onNext,
  onSalir,
  extras,
}: {
  channel: Channel;
  estado: EstadoEmision;
  visible: boolean;
  /** Con la guía abierta el dial y el rótulo se apartan: la guía ocupa abajo. */
  guiaAbierta: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSalir: () => void;
  extras: PlayerAction[];
}) {
  return (
    <div
      className={`player-bar is-fullscreen vivo-capa ${visible ? "is-visible" : ""} ${
        guiaAbierta ? "con-guia" : ""
      }`}
      role="group"
      aria-label="Controles de reproducción"
    >
      <div className="vivo-dial">
        <button
          type="button"
          data-nav="button"
          className="player-btn is-transport"
          aria-label="Canal anterior"
          title="Canal anterior"
          onClick={onPrev}
        >
          <SkipBack aria-hidden="true" fill="currentColor" />
        </button>
        <button
          type="button"
          data-nav="button"
          className="player-btn is-primary"
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          title={isPlaying ? "Pausar" : "Reproducir"}
          onClick={onTogglePlay}
        >
          {isPlaying ? (
            <Pause aria-hidden="true" fill="currentColor" />
          ) : (
            <Play aria-hidden="true" fill="currentColor" />
          )}
        </button>
        <button
          type="button"
          data-nav="button"
          className="player-btn is-transport"
          aria-label="Canal siguiente"
          title="Canal siguiente"
          onClick={onNext}
        >
          <SkipForward aria-hidden="true" fill="currentColor" />
        </button>
      </div>

      <div className="vivo-ajustes">
        <button
          type="button"
          data-nav="button"
          className="player-btn is-extra"
          aria-label={isMuted ? "Activar sonido" : "Silenciar"}
          title={isMuted ? "Activar sonido" : "Silenciar"}
          aria-pressed={isMuted}
          onClick={onToggleMute}
        >
          {isMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
        {extras.map((accion) => (
          <button
            key={accion.id}
            type="button"
            data-nav="button"
            className={`player-btn is-extra ${accion.active ? "is-emitiendo" : ""}`}
            aria-label={accion.label}
            title={accion.label}
            aria-pressed={accion.pressed}
            aria-expanded={accion.expanded}
            onClick={accion.onClick}
          >
            {accion.icon}
          </button>
        ))}
      </div>

      {/* Con palabra, siempre: es el único control que cambia de modo, y
          quien no reconozca un icono tiene que saber cómo volver. */}
      <button
        type="button"
        data-nav="button"
        className="player-btn is-extra is-mode vivo-salir"
        aria-label="Salir de pantalla completa"
        onClick={onSalir}
      >
        <ChevronLeft aria-hidden="true" />
        <span>Salir</span>
      </button>

      <div className="vivo-rotulo">
        <InfoVivo channel={channel} estado={estado} talla="grande" />
        <BarraPrograma channel={channel} activo={visible} />
      </div>
    </div>
  );
}
