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
 * **Dos grupos, no una fila.** Se navega con un mando (flechas, no dedo), así
 * que lo primero que importa es cuántas paradas hay y en qué orden — no solo
 * el color:
 *
 * 1. **El dial** (`player-bar-main`): anterior, reproducir, siguiente, en ese
 *    orden físico — el de cualquier mando de verdad (⏮ ⏯ ⏭), no el orden en
 *    que se escribieron las líneas. Redondos los dos que zapean
 *    (`is-transport`), rectangular el que decide la imagen (`is-primary`): la
 *    forma dice cuál es cuál sin leer la etiqueta.
 * 2. **La tira** (`player-bar-extras`): silencio, lo ocasional (guía, cast) y
 *    el que cambia de modo entero. Nada de esto zapea, así que vive aparte —
 *    una línea entre grupos, no seis botones seguidos que parecen el mismo.
 *
 * Y lo que no cambió:
 *
 * - **Fondo sólido, no cristal.** El translúcido se veía bien sobre una
 *   escena oscura y desaparecía sobre una clara. Opaco se ve siempre.
 * - **Las palabras se ven** en el primario y en el que cambia de modo — los
 *   dos que alguien busca sin conocer el icono. El dial y la tira restantes
 *   son solo icono a propósito: siete etiquetas escritas es ruido, no ayuda.
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
      {/* El dial de transporte: anterior-reproducir-siguiente, en ESE orden.
          Antes iba Reproducir-Anterior-Siguiente-Silenciar, cuatro rectángulos
          idénticos en fila — ni el orden ni la forma decían nada. Ahora el
          orden es el de cualquier mando físico (⏮ ⏯ ⏭) y la forma también
          separa: redondos los que zapean, rectangular el que decide qué pasa
          con la imagen. Es un dial, no una fila. */}
      <div className="player-bar-main">
        <button
          type="button"
          data-nav="button"
          className="player-btn is-extra is-transport"
          aria-label="Canal anterior"
          onClick={onPrev}
        >
          <SkipBack aria-hidden="true" />
          <span>Anterior</span>
        </button>

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
          className="player-btn is-extra is-transport"
          aria-label="Canal siguiente"
          onClick={onNext}
        >
          <SkipForward aria-hidden="true" />
          <span>Siguiente</span>
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
          aria-pressed={isMuted}
          onClick={onToggleMute}
        >
          {isMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
          <span>{isMuted ? "Sonido" : "Silenciar"}</span>
        </button>

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
