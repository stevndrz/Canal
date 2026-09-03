"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extrasCast, PlayerControls } from "@/components/player/player-controls";
import { useCast } from "@/hooks/use-cast";
import { esIPhone } from "@/lib/dispositivo";
import { esToqueEnElVideo } from "@/lib/toque-en-el-video";
import { cambioDeSalud } from "@/lib/salud-de-la-emision";
import type { Channel, PlaybackSettings } from "@/lib/types";
import StreamPlayer, {
  type StreamPlayerHandle,
  type StreamPlayerState,
} from "@/components/stream-player";

/**
 * El canal en directo dentro de Inicio: la pieza que hace que la app se abra
 * viendo la tele y no una parrilla.
 *
 * Comparte `StreamPlayer` con el reproductor grande, así que HLS, MPEG-TS y
 * reintentos son idénticos; lo que cambia es el chrome. Nunca están montados
 * los dos a la vez, y eso importa: serían el doble de ancho de banda y dos
 * audios. Aquí tampoco va el reloj — la barra lo enseña a dos centímetros.
 */
interface LiveCardProps {
  channel: Channel;
  settings: PlaybackSettings;
  /** Pasar a pantalla completa con este canal. */
  onExpand: (channel: Channel) => void;
  /** Cambiar de canal sin salir de Inicio. */
  onNext: () => void;
  onPrev: () => void;
  /**
   * La persona ha tocado el botón de sonido.
   *
   * Solo eso: el reproductor se silencia y se desilencia solo al arrancar, y
   * guardar aquellos cambios escribiría ruido. Ver `recordarSilencio`.
   */
  onSilencio?: (mudo: boolean) => void;
  /**
   * Si este canal ha llegado a dar imagen o ha fallado.
   *
   * Es lo único que se puede saber de verdad sobre la salud de un canal, y lo
   * sabe el reproductor. Ver `canales-caidos.ts`.
   */
  onSalud?: (canalId: number, funciona: boolean) => void;
}

export function LiveCard({
  channel,
  settings,
  onExpand,
  onNext,
  onPrev,
  onSilencio,
  onSalud,
}: LiveCardProps) {
  const playerRef = useRef<StreamPlayerHandle | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<StreamPlayerState>({
    isPlaying: true,
    isMuted: true,
    streamError: false,
    needsUserGesture: false,
  });

  /**
   * Lo que el reproductor le cuenta a esta tarjeta. **Tiene que ser estable**:
   * con una función en línea se abría un bucle de render sin fin con
   * `StreamPlayer`, y el planificador quedaba ocupado sin parar, así que la
   * navegación a «Cine y series» —una transición— **no se confirmaba nunca**
   * mientras hubiera vídeo. `StreamPlayer` lo blinda por su lado; esto por el
   * otro.
   *
   * La salud se decide por **flanco** y no por nivel: como condición sobre el
   * estado actual, un canal caído disparaba en cada vuelta, y cada disparo
   * escribía en `localStorage` y reordenaba 7.822 canales. Ver `cambioDeSalud`.
   */
  const previo = useRef<{ canal: number; lectura: StreamPlayerState } | null>(null);
  const alCambiarEstado = useCallback(
    (siguiente: StreamPlayerState) => {
      setState(siguiente);
      // Al zapear se olvida la lectura anterior: la salud de un canal no dice
      // nada del siguiente, y compararlos daría un flanco inventado. Por eso la
      // `ref` guarda de qué canal era la lectura, y no solo la lectura.
      const anterior = previo.current?.canal === channel.id ? previo.current.lectura : undefined;
      previo.current = { canal: channel.id, lectura: siguiente };
      const cambio = cambioDeSalud(anterior, siguiente);
      if (cambio) onSalud?.(channel.id, cambio === "revivio");
    },
    [channel.id, onSalud],
  );

  /**
   * Pantalla completa de verdad, en un solo gesto: `requestFullscreen` **solo
   * funciona dentro de un gesto**, así que se pide aquí y no tras cambiar de
   * vista.
   *
   * ⚠️ **En iPhone NO se cambia de vista.** Cambiar desmonta este reproductor,
   * el `<video>` al que se acaba de pedir pantalla completa desaparece en el
   * mismo fotograma y iOS la cancela — se veía el vídeo con la barra de Safari
   * encima. Y tampoco aportaría nada: `webkitEnterFullscreen` abre el
   * reproductor del sistema por encima de todo.
   *
   * En el resto se pide sobre el documento, que sobrevive al cambio de vista.
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

  /**
   * Tocar la imagen pausa y reanuda.
   *
   * **Sin temporizador**, aunque el doble clic siga llevando a pantalla
   * completa. Un doble clic son dos clics más el `dblclick`: el primero pausa,
   * el segundo reanuda —queda como estaba— y después se expande. Esperar 250 ms
   * a ver si llega el segundo daría un pausado con retardo, y el retardo en un
   * control tan básico se nota mucho más que el parpadeo que evita.
   */
  const alTocar = useCallback((evento: React.MouseEvent) => {
    if (!esToqueEnElVideo(evento.target)) return;
    playerRef.current?.togglePlay();
  }, []);

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
        <div className="live-card-video" onClick={alTocar} onDoubleClick={expandir}>
          <StreamPlayer
            ref={playerRef}
            channel={channel}
            settings={settings}
            onStateChange={alCambiarEstado}
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

          {/* Aquí había un segundo «Este canal no está responde» con su propio
              botón Reintentar, pintado ENCIMA del «Sin señal» que `StreamPlayer`
              ya dibuja a pantalla completa dentro de este mismo marco. Eran dos
              mensajes distintos del mismo fallo y dos botones que hacían lo
              mismo, y con el mando había que pasar por los dos. Manda el del
              reproductor, que es quien sabe qué pasó. */}
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
          onToggleMute={() => {
            playerRef.current?.toggleMute();
            onSilencio?.(!state.isMuted);
          }}
          onPrev={onPrev}
          onNext={onNext}
          fullscreen={{ active: false, onToggle: expandir }}
          big={settings.bigControls}
          extras={transmision}
          meta={{ canal: channel.name, enVivo: true }}
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
 * Pantalla completa en todo lo que no sea un iPhone. Se pide sobre
 * `document.documentElement` y no sobre el contenedor del reproductor, que
 * está a punto de desmontarse.
 *
 * Se **espera** cada intento en vez de lanzarlo y olvidarse: si el navegador
 * lo rechaza hay que enterarse para probar el siguiente.
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
 * Pantalla completa en iPhone: el reproductor del sistema, y nada más. Safari
 * **no entrega la pantalla a nada que no sea un `<video>`**; desde iOS 26
 * `requestFullscreen` existe sobre otros elementos pero no esconde las barras,
 * así que probarlo antes solo estorba.
 *
 * Requiere metadatos cargados, y si no han llegado se espera en vez de fallar
 * en silencio. Se ven los controles de Apple y no los nuestros; a cambio, AirPlay.
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
