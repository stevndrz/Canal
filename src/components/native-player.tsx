"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Airplay,
  Captions,
  Cast,
  Languages,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RefreshCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCast, type SubtituloCast } from "@/hooks/use-cast";
import { useSeguirViendo } from "@/hooks/use-progreso";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { esIPhone } from "@/lib/dispositivo";
import { extensionDe } from "@/lib/extension";
import type { ManualStream } from "@/lib/catalog/types";
import {
  planAnteErrorFatal,
  prefiereNativoPorAirplay,
  type EstadoRecuperacion,
} from "@/lib/reproduccion/motor";

/**
 * Reproductor nativo para los enlaces propios del catálogo (`manual`).
 *
 * **Todo control lleva `data-nav`.** `useSpatialNav` solo recoge `[data-nav]`
 * y además hace `preventDefault()` en las cuatro flechas, así que un mando no
 * puede llegar a nada que no lo lleve — y en un televisor no hay Tab. Sin
 * estos atributos, esta pantalla era un callejón sin salida: no se podía ni
 * pausar, ni silenciar, ni salir de pantalla completa.
 *
 * Solo aquí tiene sentido añadir controles avanzados: en las fichas de tipo
 * `embed` manda el reproductor del proveedor, con sus propios controles.
 *
 * Reutiliza el mismo patrón de recuperación de errores que el de canales, pero
 * añade barra de progreso (una película sí se busca, un canal en vivo no),
 * selector de pistas de audio y de subtítulos.
 */

interface AudioTrackOption {
  id: number;
  label: string;
}

function detectKind(stream: ManualStream): "hls" | "native" {
  if (stream.type === "hls") return "hls";
  if (stream.type === "mp4") return "native";
  return extensionDe(stream.url) === "m3u8" ? "hls" : "native";
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export const NativePlayer = memo(function NativePlayer({
  streams,
  title,
  claveProgreso,
}: {
  streams: ManualStream[];
  title: string;
  /**
   * Con qué nombre recordar por dónde iba esto. Sin ella no se sigue nada.
   *
   * Es opcional porque no todo lo que pasa por aquí se puede retomar: quien
   * llame decide. Ver `lib/progreso.ts` para las claves.
   */
  claveProgreso?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [streamIndex, setStreamIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioTracks, setAudioTracks] = useState<AudioTrackOption[]>([]);
  const [activeAudio, setActiveAudio] = useState<number | null>(null);
  const [activeSubtitle, setActiveSubtitle] = useState<number | null>(null);
  /** Línea de subtítulo activa, para pintarla en la capa propia. */
  const [subtitleText, setSubtitleText] = useState("");

  const stream = streams[streamIndex] ?? streams[0];
  const subtitles = useMemo(() => stream?.subtitles ?? [], [stream]);

  /**
   * Los subtítulos también tienen que verse en la tele al transmitir: sin
   * pasarlos al hook, el receptor recibe el vídeo mudo de letras. Memoizado
   * para que la identidad no cambie en cada render (el hook los usa en
   * efectos).
   */
  const subtitulosCast = useMemo<SubtituloCast[]>(
    () =>
      subtitles.map((pista) => ({
        url: pista.url,
        label: pista.label,
        lang: pista.srclang,
        porDefecto: Boolean(pista.default),
      })),
    [subtitles],
  );

  // Película o episodio: BUFFERED en el receptor, con búsqueda. El subtítulo
  // elegido aquí es el que se activa allí (o el marcado por defecto).
  const { castMethod, isCasting, startCasting, stopCasting, castError, dismissCastError } =
    useCast(videoRef, stream?.url ?? "", title, {
      enVivo: false,
      subtitulos: subtitulosCast,
      subtituloActivo: activeSubtitle,
    });
  const { isFullscreen, isSupported: canFullscreen, toggleFullscreen } = useFullscreen(containerRef, videoRef);

  /**
   * Por dónde iba, si se sabe. Escribe directo, sin estado: ver el hook.
   */
  const { posicionParaRetomar, apuntar } = useSeguirViendo(claveProgreso);

  const retry = useCallback(() => setRetryCount((count) => count + 1), []);

  // --- Carga del stream -----------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream?.url) return;

    let cancelled = false;
    setHasError(false);
    setIsLoading(true);
    setAudioTracks([]);
    setActiveAudio(null);

    hlsRef.current?.destroy();
    hlsRef.current = null;
    video.removeAttribute("src");
    video.load();

    const fail = () => {
      if (cancelled) return;
      setHasError(true);
      setIsLoading(false);
    };

    // Misma regla que el motor de canales: en los WebKit con AirPlay el HLS
    // va nativo (ver `prefiereNativoPorAirplay`), hls.js solo para el resto.
    if (detectKind(stream) === "hls" && !prefiereNativoPorAirplay(video) && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) return;
        // Las pistas de audio solo son accesibles de forma fiable por hls.js:
        // Chrome no expone video.audioTracks.
        const tracks = hls.audioTracks ?? [];
        setAudioTracks(tracks.map((track, index) => ({ id: index, label: track.name || track.lang || `Pista ${index + 1}` })));
        setActiveAudio(tracks.length > 0 ? hls.audioTrack : null);
      });

      /**
       * Recuperación acotada según la política común del motor
       * (`planAnteErrorFatal`). Abandonar NO es rendirse del todo: antes de
       * dar el enlace por muerto se prueba UNA vía más — entregarlo al
       * `<video>` tal cual, porque varios televisores leen HLS de forma
       * nativa aunque su MSE falle; si tampoco puede, `error` cae en
       * `onNativeError`, que ya enseña el aviso de siempre.
       */
      const recuperacion: EstadoRecuperacion = { intentos: 0, mediosRecuperados: false };
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) return;
        const plan = planAnteErrorFatal(
          recuperacion,
          data.type === Hls.ErrorTypes.NETWORK_ERROR
            ? "red"
            : data.type === Hls.ErrorTypes.MEDIA_ERROR
              ? "medios"
              : "otro",
        );
        if (plan === "abandonar") {
          hls.destroy();
          hlsRef.current = null;
          video.src = stream.url;
          return;
        }
        recuperacion.intentos++;
        if (plan === "reintentar-medios") {
          recuperacion.mediosRecuperados = true;
          hls.recoverMediaError();
        } else {
          hls.startLoad();
        }
      });

      hls.loadSource(stream.url);
      hls.attachMedia(video);
    } else {
      video.src = stream.url;
    }

    const onLoadedMetadata = () => {
      if (cancelled) return;
      setDuration(video.duration);
      setIsLoading(false);

      /**
       * Retomar donde se quedó, una sola vez y solo si queda algo por ver.
       *
       * Va aquí y no antes porque hasta `loadedmetadata` el `<video>` no acepta
       * un `currentTime`: asignarlo antes se pierde en silencio. Y se compara
       * con la duración ya conocida para no saltar al final de un archivo
       * distinto que reutilizara la clave.
       */
      const retomar = posicionParaRetomar();
      if (retomar !== undefined && retomar < video.duration) {
        video.currentTime = retomar;
      }
    };
    const onTimeUpdate = () => {
      if (cancelled) return;
      setCurrentTime(video.currentTime);
      apuntar(video.currentTime, video.duration);
    };
    const onPlay = () => !cancelled && setIsPlaying(true);
    const onPause = () => {
      if (cancelled) return;
      setIsPlaying(false);
      // Pausar es de los momentos que sí importan: quien pausa suele irse.
      apuntar(video.currentTime, video.duration, true);
    };
    const onEnded = () => apuntar(video.duration, video.duration, true);
    const onWaiting = () => !cancelled && setIsLoading(true);
    const onPlaying = () => {
      if (cancelled) return;
      setIsLoading(false);
      setHasError(false);
    };
    const onNativeError = () => {
      if (!hlsRef.current) fail();
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onNativeError);
    video.addEventListener("ended", onEnded);

    return () => {
      cancelled = true;
      /**
       * Al desmontar se apunta a la fuerza: salir de la pantalla es el momento
       * más habitual de dejar algo a medias, y esperar al siguiente turno del
       * reloj perdería justo esa posición.
       */
      apuntar(video.currentTime, video.duration, true);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onNativeError);
      video.removeEventListener("ended", onEnded);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [stream, retryCount, apuntar, posicionParaRetomar]);

  // --- Subtítulos -----------------------------------------------------------
  /**
   * Los subtítulos se pintan en una capa propia, no los dibuja el navegador.
   *
   * El motivo es un fallo real de televisores Samsung (Tizen): su capa nativa
   * de pistas de texto desaparece cuando la pantalla completa se pide sobre
   * un contenedor del `<video>` — que es justo como entra aquí a lo grande —,
   * así que los subtítulos se veían en la ficha y se esfumaban en fullscreen.
   *
   * Con `mode = "hidden"` la pista activa sigue avisando por `cuechange` sin
   * que nadie la dibuje, y el texto activo va a un div nuestro dentro del
   * contenedor: al ser DOM normal, escala con la pantalla completa en cualquier
   * aparato. En iPhone no aplica: allí el botón abre el reproductor del
   * sistema, que pinta él mismo las pistas, así que se dejan en `showing` y la
   * capa propia se omite para no salir dos veces.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const pistas = Array.from(video.textTracks);
    const nativoDelSistema = esIPhone();
    pistas.forEach((pista, i) => {
      pista.mode = i === activeSubtitle ? (nativoDelSistema ? "showing" : "hidden") : "disabled";
    });

    if (activeSubtitle === null || nativoDelSistema) {
      setSubtitleText("");
      return;
    }

    const pistaActiva = pistas[activeSubtitle];
    if (!pistaActiva) {
      setSubtitleText("");
      return;
    }

    const pintar = () => {
      const activos = pistaActiva.activeCues;
      setSubtitleText(
        activos
          ? Array.from(activos)
              .map((cue) => (cue as VTTCue).text)
              .join("\n")
          : "",
      );
    };

    pintar();
    pistaActiva.addEventListener("cuechange", pintar);
    return () => pistaActiva.removeEventListener("cuechange", pintar);
  }, [activeSubtitle, subtitles]);

  // --- Controles ------------------------------------------------------------
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  const seekTo = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const selectAudio = useCallback((id: number) => {
    if (hlsRef.current) {
      hlsRef.current.audioTrack = id;
      setActiveAudio(id);
    }
  }, []);

  if (!stream) {
    return (
      <div className="player-sin-enlace">Esta ficha no tiene ningún enlace configurado.</div>
    );
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="player-surface relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          muted={isMuted}
          /* Transmitir: sin estos atributos Safari no ofrece AirPlay sobre
             este vídeo y algunas TVs rechazan el flujo .m3u8 por CORS. */
          x-webkit-airplay="allow"
          crossOrigin="anonymous"
          disableRemotePlayback={false}
        >
          {subtitles.map((track) => (
            <track
              key={track.url}
              kind="subtitles"
              src={track.url}
              srcLang={track.srclang}
              label={track.label}
            />
          ))}
        </video>

        {/* Subtítulos propios: capa DOM dentro de este contenedor, así
            sobreviven al fullscreen del contenedor en cualquier televisor. */}
        {subtitleText && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[6%] z-10 flex justify-center px-[5%]">
            <span className="whitespace-pre-line rounded-md bg-black/70 px-3 py-1 text-center text-base font-medium leading-snug text-white md:text-lg xl:text-xl">
              {subtitleText}
            </span>
          </div>
        )}

        {/* Fallo al transmitir. Antes solo se escribía en la consola, así que
            desde fuera parecía que el botón simplemente no hacía nada. */}
        {castError && (
          <div className="absolute inset-x-3 top-3 z-20 flex items-start gap-2 rounded-xl bg-red-950/90 p-3 text-sm text-red-50 shadow-lg backdrop-blur-md">
            <Cast aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
            <p className="flex-1">{castError}</p>
            <button
              data-nav="button"
              type="button"
              onClick={dismissCastError}
              aria-label="Cerrar aviso"
              className="shrink-0 rounded-lg px-2 py-0.5 font-bold text-red-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              ✕
            </button>
          </div>
        )}

        {isLoading && !hasError && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" role="status">
            <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin text-white/70" />
            <span className="sr-only">Cargando…</span>
          </div>
        )}

        {hasError && (
          <div role="alert" className="player-fallo">
            <p className="player-fallo-titulo">No se pudo reproducir</p>
            <p className="player-fallo-detalle">
              El enlace no respondió. Prueba otra versión o inténtalo de nuevo.
            </p>
            <button data-nav="button" type="button" onClick={retry} className="player-btn is-primary">
              <RefreshCw aria-hidden="true" />
              Reintentar
            </button>
          </div>
        )}
      </div>

      {/* Barra de progreso: una película sí se busca, un canal en vivo no. */}
      <div className="player-barra-tiempo">
        <span>{formatTime(currentTime)}</span>
        <input
          data-nav="input"
          type="range"
          min={0}
          max={duration || 0}
          step={1}
          value={currentTime}
          onChange={(event) => seekTo(Number(event.target.value))}
          aria-label="Posición de reproducción"
        />
        <span>{formatTime(duration)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          data-nav="button"
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pausar" : "Reproducir"}
          className="player-btn is-extra"
        >
          {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </button>

        <button
          data-nav="button"
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? "Activar sonido" : "Silenciar"}
          className="player-btn is-extra"
        >
          {isMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>

        {/* Versiones del mismo título (doblajes, calidades) */}
        {streams.length > 1 && (
          <label className="player-btn player-select">
            <Languages aria-hidden="true" />
            <span className="sr-only">Versión</span>
            <select
              data-nav="input"
              value={streamIndex}
              onChange={(event) => setStreamIndex(Number(event.target.value))}
            >
              {streams.map((option, index) => (
                <option key={option.url} value={index}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {/* Solo aparece si el archivo trae más de una pista de audio */}
        {audioTracks.length > 1 && (
          <label className="player-btn player-select">
            <Languages aria-hidden="true" />
            <span className="sr-only">Audio</span>
            <select
              data-nav="input"
              value={activeAudio ?? 0}
              onChange={(event) => selectAudio(Number(event.target.value))}
            >
              {audioTracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {track.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {subtitles.length > 0 && (
          <label className="player-btn player-select">
            <Captions aria-hidden="true" />
            <span className="sr-only">Subtítulos</span>
            <select
              data-nav="input"
              value={activeSubtitle ?? -1}
              onChange={(event) => {
                const value = Number(event.target.value);
                setActiveSubtitle(value < 0 ? null : value);
              }}
            >
              <option value={-1}>
                Sin subtítulos
              </option>
              {subtitles.map((track, index) => (
                <option key={track.url} value={index}>
                  {track.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="ml-auto flex items-center gap-2">
        {/* Un botón por vía, no uno genérico: en Android aparece Chromecast
            y en iOS AirPlay. Si no hay ninguna disponible, ninguno. */}
        {castMethod === "gcast" && (
          <button
            data-nav="button"
            type="button"
            onClick={isCasting ? stopCasting : startCasting}
            aria-label={isCasting ? "Dejar de transmitir a la TV" : "Transmitir con Chromecast"}
            className={`player-btn is-extra ${isCasting ? "is-emitiendo" : ""}`}
          >
            <Cast aria-hidden="true" />
          </button>
        )}

        {castMethod === "airplay" && (
          /* Encendido mientras emite y sirviendo para cortar, igual que el de
             Chromecast: sin estado, el botón se veía idéntico funcionara o no. */
          <button
            data-nav="button"
            type="button"
            onClick={isCasting ? stopCasting : startCasting}
            aria-pressed={isCasting}
            aria-label={isCasting ? "Dejar de transmitir con AirPlay" : "Transmitir con AirPlay"}
            className={`player-btn is-extra ${isCasting ? "is-emitiendo" : ""}`}
          >
            <Airplay aria-hidden="true" />
          </button>
        )}

          {canFullscreen && (
            <button
              data-nav="button"
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
              className="player-btn is-extra"
            >
              {isFullscreen ? (
                <Minimize aria-hidden="true" />
              ) : (
                <Maximize aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export default NativePlayer;
