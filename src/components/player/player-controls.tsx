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
 * Tres decisiones de diseño, y ninguna es de gusto:
 *
 * 1. **Jerarquía, no uniformidad.** Antes eran seis círculos idénticos de 58px:
 *    pausar pesaba lo mismo que un ajuste ocasional. Si todo parece igual de
 *    importante, no lo parece nada. Ahora hay un control primario, unos
 *    secundarios y unos terciarios, y el tamaño lo dice.
 *
 * 2. **Fondo sólido, no cristal.** El translúcido con desenfoque se veía bien
 *    sobre una escena oscura y desaparecía sobre una clara: el contraste
 *    dependía de lo que estuvieran emitiendo. Un fondo opaco se ve siempre.
 *
 * 3. **Las palabras se ven.** Un icono solo funciona para quien ya lo conoce.
 *    Los controles principales llevan su etiqueta escrita, y con el ajuste
 *    `bigControls` la llevan todos.
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
  /** Sube tamaños y saca las etiquetas de los secundarios. */
  big?: boolean;
  /** `embedded` vive debajo del vídeo; `fullscreen`, encima. */
  variant: "embedded" | "fullscreen";
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
}: PlayerControlsProps) {
  const clases = ["player-bar", `is-${variant}`, big ? "is-big" : ""].filter(Boolean).join(" ");

  return (
    <div className={clases} role="group" aria-label="Controles de reproducción">
      <div className="player-bar-main">
        <button
          type="button"
          data-nav="button"
          className="player-btn is-primary"
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          onClick={onTogglePlay}
        >
          {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          <span>{isPlaying ? "Pausar" : "Reproducir"}</span>
        </button>

        <button
          type="button"
          data-nav="button"
          className="player-btn"
          aria-label="Canal anterior"
          onClick={onPrev}
        >
          <SkipBack aria-hidden="true" />
          <span>Anterior</span>
        </button>

        <button
          type="button"
          data-nav="button"
          className="player-btn"
          aria-label="Canal siguiente"
          onClick={onNext}
        >
          <SkipForward aria-hidden="true" />
          <span>Siguiente</span>
        </button>

        <button
          type="button"
          data-nav="button"
          className="player-btn"
          aria-label={isMuted ? "Activar sonido" : "Silenciar"}
          aria-pressed={isMuted}
          onClick={onToggleMute}
        >
          {isMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          <span>{isMuted ? "Sonido" : "Silenciar"}</span>
        </button>
      </div>

      <div className="player-bar-extras">
        {extras.map((accion) => (
          <button
            key={accion.id}
            type="button"
            data-nav="button"
            className={`player-btn is-extra ${accion.active ? "is-active" : ""}`}
            aria-label={accion.label}
            aria-pressed={accion.pressed}
            aria-expanded={accion.expanded}
            onClick={accion.onClick}
          >
            {accion.icon}
            <span>{accion.label}</span>
          </button>
        ))}

        <button
          type="button"
          data-nav="button"
          /* `is-mode`: este no se calla nunca. Guía y cast pueden ser
             solo icono porque son ocasionales, pero entrar y salir de pantalla
             completa cambia el modo entero de la aplicación, y quien no
             reconozca las cuatro esquinitas se queda sin saber cómo volver. */
          className="player-btn is-extra is-mode"
          aria-label={fullscreen.active ? "Salir de pantalla completa" : "Pantalla completa"}
          onClick={fullscreen.onToggle}
        >
          {fullscreen.active ? <Minimize aria-hidden="true" /> : <Maximize aria-hidden="true" />}
          <span>{fullscreen.active ? "Salir" : "Pantalla completa"}</span>
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
