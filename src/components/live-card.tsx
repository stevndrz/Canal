"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extrasCast, PlayerControls } from "@/components/player/player-controls";
import { useCast } from "@/hooks/use-cast";
import { esIPhone } from "@/lib/dispositivo";
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
   * `requestFullscreen` **solo funciona dentro de un gesto de la persona**, así
   * que se pide aquí mismo y no después de cambiar de vista.
   *
   * ⚠️ **En iPhone NO se cambia de vista.** Es la corrección que costó dos
   * intentos entender. `onExpand` lleva a la vista `player`, y eso desmonta
   * este reproductor para montar otro: el `<video>` al que se le acaba de
   * pedir pantalla completa **desaparece del documento en el mismo
   * fotograma**, y iOS cancela la pantalla completa al quedarse sin elemento.
   * El resultado era justo lo que se veía: el vídeo ocupando la ventana y la
   * barra de Safari encima.
   *
   * Además, en iPhone cambiar de vista no aporta nada: `webkitEnterFullscreen`
   * abre el reproductor del sistema por encima de todo, así que nuestra vista
   * quedaría detrás sin que nadie la vea.
   *
   * En el resto se pide sobre el documento entero —que sobrevive al cambio de
   * vista— y sí se cambia, para conservar nuestros controles.
   */
  const expandir = useCallback(() => {
    if (esIPhone()) {
      pedirPantallaCompletaIPhone(playerRef.current?.video() ?? null);
      return;
    }
    // Sin `await`: `requestFullscreen` tiene que salir dentro del gesto de la
    // persona, y esperar aquí devolvería el control al navegador antes.
    void pedirPantallaCompleta();
    onExpand(channel);
  }, [onExpand, channel]);

  // El vídeo real vive dentro de StreamPlayer y se expone por método; Cast lo
  // necesita como ref, así que se copia en cuanto existe.
  useEffect(() => {
    videoRef.current = playerRef.current?.video() ?? null;
  }, [channel.streamUrl]);

  const { castMethod, isCasting, startCasting, stopCasting, castError, dismissCastError } = useCast(
    videoRef,
    channel.streamUrl,
    channel.name,
  );

  const transmision = extrasCast({ metodo: castMethod, isCasting, startCasting, stopCasting });

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
          extras={transmision}
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
 * Pantalla completa en todo lo que no sea un iPhone.
 *
 * Se pide sobre `document.documentElement` y no sobre el contenedor del
 * reproductor porque ese contenedor está a punto de desmontarse: la vista
 * cambia justo después. El documento sobrevive.
 *
 * Se **espera** cada intento en vez de lanzarlo y olvidarse: si el navegador
 * lo rechaza hay que enterarse para probar el siguiente. Un `.catch()` que
 * traga el error con un `return` detrás deja sin pantalla completa y sin
 * ninguna pista de por qué.
 */
async function pedirPantallaCompleta(): Promise<void> {
  const raiz = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  try {
    if (typeof raiz.requestFullscreen === "function") {
      await raiz.requestFullscreen({ navigationUI: "hide" });
      return;
    }
    if (typeof raiz.webkitRequestFullscreen === "function") {
      await raiz.webkitRequestFullscreen();
    }
  } catch {
    // Algunos navegadores de televisor la rechazan sobre <html>. No hay más
    // respaldo que ofrecer: la vista igualmente ocupa toda la ventana.
  }
}

/**
 * Pantalla completa en iPhone: el reproductor del sistema, y nada más.
 *
 * Safari en iPhone **no entrega la pantalla a ningún elemento que no sea un
 * `<video>`**. Desde iOS 26 `requestFullscreen` existe sobre otros elementos,
 * pero no esconde las barras del navegador, así que probarlo primero solo
 * sirve para no llegar nunca a la única vía que sí funciona.
 *
 * Requiere metadatos cargados; si aún no han llegado se espera a ellos en vez
 * de fallar en silencio. El precio de esta vía es que se ven los controles de
 * Apple y no los nuestros; a cambio trae AirPlay.
 */
function pedirPantallaCompletaIPhone(video: HTMLVideoElement | null): void {
  const nativo = video as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
  if (!nativo?.webkitEnterFullscreen) return;

  if (nativo.readyState >= 1) {
    nativo.webkitEnterFullscreen();
    return;
  }
  nativo.addEventListener("loadedmetadata", () => nativo.webkitEnterFullscreen?.(), { once: true });
}
