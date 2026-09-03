"use client";

import type { ReactNode } from "react";
import {
  Airplay,
  Cast,
  List,
  Maximize,
  Minimize,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { CastMethod } from "@/hooks/use-cast";

/**
 * La barra de controles, compartida por el reproductor pequeño de Inicio y el
 * de pantalla completa.
 *
 * Es un componente y no dos porque la queja era justamente esa: dos sitios que
 * hacían lo mismo con aspectos distintos. Aprender una vale para los dos.
 *
 * Estilo Apple TV sobre estructura de dial: píldora de cristal flotante con
 * botones circulares solo de icono (con `title` y `aria-label` para quien no
 * los reconozca), play central grande en blanco y pastilla «EN VIVO» con el
 * canal. En directo no hay progreso que buscar —zapear es el único
 * movimiento—, así que la barra es transporte puro más la pastilla.
 *
 * Se mantienen los nombres de clase (`player-bar`, `player-btn`…) a propósito:
 * la navegación por mando, el detector de toques en el vídeo y el CSS que
 * coloca la barra encima del vídeo los usan como ganchos.
 *
 * El orden físico es el de cualquier mando de verdad (⏮ ⏯ ⏭): anterior,
 * reproducir y siguiente forman el dial, y silencio, lo ocasional (guía,
 * cast) y el cambio de modo viven en la tira separada por una línea.
 */
export interface PlayerAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Refleja el estado en el botón (silencio activo, emitiendo a la TV…). */
  active?: boolean;
  pressed?: boolean;
  expanded?: boolean;
}

/** Lo que la pastilla enseña a la izquierda de la botonera. */
export interface PlayerMeta {
  /** Nombre del canal sintonizado. */
  canal?: string;
  /** La pastilla «EN VIVO» con su punto rojo. En diferido, no. */
  enVivo?: boolean;
}

interface PlayerControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onPrev: () => void;
  onNext: () => void;
  /** Entrar o salir de pantalla completa. Un solo botón, un solo estado. */
  fullscreen: { active: boolean; onToggle: () => void };
  /** Guía, cast… Lo que no se usa en cada minuto. */
  extras?: PlayerAction[];
  /** Sube tamaños. */
  big?: boolean;
  /** `embedded` vive debajo del vídeo; `fullscreen`, encima. */
  variant: "embedded" | "fullscreen";
  /** Pastilla informativa (canal + EN VIVO). Sin ella no se pinta nada. */
  meta?: PlayerMeta;
}

export function PlayerControls({
  isPlaying,
  isMuted,
  onTogglePlay,
  onToggleMute,
  onPrev,
  onNext,
  fullscreen,
  extras = [],
  big = false,
  variant,
  meta,
}: PlayerControlsProps) {
  const clases = ["player-bar", `is-${variant}`, big ? "is-big" : ""].filter(Boolean).join(" ");

  return (
    <div className={clases} role="group" aria-label="Controles de reproducción">
      {(meta?.enVivo || meta?.canal) && (
        <span className="player-live" aria-label={meta.canal ? `En directo: ${meta.canal}` : "En directo"}>
          {meta.enVivo && <span className="player-live-dot" aria-hidden="true" />}
          {meta.enVivo && <span className="player-live-texto">En vivo</span>}
          {meta.enVivo && meta.canal && (
            <span className="player-live-sep" aria-hidden="true">
              ·
            </span>
          )}
          {meta.canal && <span className="player-live-canal">{meta.canal}</span>}
        </span>
      )}

      {/* El dial de transporte: anterior-reproducir-siguiente, en ESE orden.
          El orden es el de cualquier mando físico (⏮ ⏯ ⏭) y la forma también
          separa: redondos los que zapean, blanco el que decide qué pasa con
          la imagen. Es un dial, no una fila. */}
      <div className="player-bar-main">
        <button
          type="button"
          data-nav="button"
          className="player-btn is-extra is-transport"
          aria-label="Canal anterior"
          title="Canal anterior"
          onClick={onPrev}
        >
          <SkipBack aria-hidden="true" />
        </button>

        <button
          type="button"
          data-nav="button"
          className="player-btn is-primary"
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          title={isPlaying ? "Pausar" : "Reproducir"}
          onClick={onTogglePlay}
        >
          {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </button>

        <button
          type="button"
          data-nav="button"
          className="player-btn is-extra is-transport"
          aria-label="Canal siguiente"
          title="Canal siguiente"
          onClick={onNext}
        >
          <SkipForward aria-hidden="true" />
        </button>
      </div>

      {/* La tira de sistema: silencio, lo ocasional (guía, cast) y el que
          cambia de modo. Nada de esto zapea ni decide qué se ve — por eso
          vive separado del dial por una línea, no mezclado en la misma fila. */}
      <div className="player-bar-extras">
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
            className={`player-btn is-extra ${accion.active ? "is-active" : ""}`}
            aria-label={accion.label}
            title={accion.label}
            aria-pressed={accion.pressed}
            aria-expanded={accion.expanded}
            onClick={accion.onClick}
          >
            {accion.icon}
          </button>
        ))}

        <button
          type="button"
          data-nav="button"
          /* `is-mode`: este no se calla nunca. Entrar y salir de pantalla
             completa cambia el modo entero de la aplicación, y quien no
             reconozca las cuatro esquinitas se queda sin saber cómo volver:
             por eso conserva su palabra corta. */
          className="player-btn is-extra is-mode"
          aria-label={fullscreen.active ? "Salir de pantalla completa" : "Pantalla completa"}
          title={fullscreen.active ? "Salir de pantalla completa" : "Pantalla completa"}
          onClick={fullscreen.onToggle}
        >
          {fullscreen.active ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
          <span>{fullscreen.active ? "Salir" : "Pantalla"}</span>
        </button>
      </div>
    </div>
  );
}

/** Iconos de los controles ocasionales, para que los dos sitios usen los mismos. */
export const ICONO_GUIA = <List aria-hidden="true" />;
export const ICONO_CAST = <Cast aria-hidden="true" />;
export const ICONO_AIRPLAY = <Airplay aria-hidden="true" />;

/**
 * Botones de transmisión, compartidos por Inicio y pantalla completa: uno por
 * vía detectada —Chromecast en Chrome/Android, AirPlay en iOS/Safari—, y sin
 * ninguno si el hook no encontró soporte. Un solo sitio para que los dos
 * reproductores se comporten igual.
 */
export function extrasCast({
  metodo,
  isCasting,
  startCasting,
  stopCasting,
}: {
  metodo: CastMethod | null;
  isCasting: boolean;
  startCasting: () => void;
  stopCasting: () => void;
}): PlayerAction[] {
  return [
    ...(metodo === "gcast"
      ? [
          {
            id: "chromecast",
            label: isCasting ? "Dejar de transmitir" : "Transmitir con Chromecast",
            icon: ICONO_CAST,
            active: isCasting,
            pressed: isCasting,
            onClick: isCasting ? stopCasting : startCasting,
          },
        ]
      : []),
    ...(metodo === "airplay"
      ? [
          {
            // Mismo trato que Chromecast: encendido mientras la imagen va a la
            // tele, y sirviendo para cortarla. Antes era un botón mudo —ni
            // cambiaba de aspecto ni podía apagar nada—, así que estuviera
            // funcionando o no se veía exactamente igual.
            id: "airplay",
            label: isCasting ? "Dejar de transmitir" : "Transmitir con AirPlay",
            icon: ICONO_AIRPLAY,
            active: isCasting,
            pressed: isCasting,
            onClick: isCasting ? stopCasting : startCasting,
          },
        ]
      : []),
  ];
}
