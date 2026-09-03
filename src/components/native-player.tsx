"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Airplay,
  Captions,
  Cast,
  Check,
  Gauge,
  Languages,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
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

/** Velocidades del reproductor, como en tvOS: las habituales y nada más. */
const VELOCIDADES = [0.5, 1, 1.25, 1.5, 2] as const;
/** Cuánto se esconde la barra cuando nadie la toca y el vídeo sigue andando. */
const OCULTAR_CONTROLES_MS = 3200;
const SALTO_S = 10;

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

  /**
   * Pausa síncrona al ocultarse.
   *
   * Con `cacheComponents` activado (ver `next.config.ts`), Next no desmonta
   * la ficha al navegar a otra sección: la oculta con `<Activity>`, que es
   * `display:none` conservando el DOM. Eso no para un `<video>` — la limpieza
   * de más abajo sí lo hace, pero vive en un `useEffect` normal, que corre
   * DESPUÉS de pintar. Mientras tanto la película seguía sonando de fondo con
   * el canal ya sintonizado encima: el «duplicado» al cambiar de pestaña.
   * `useLayoutEffect` corre en el mismo commit que oculta el árbol.
   */
  useLayoutEffect(() => {
    const video = videoRef.current;
    return () => {
      video?.pause();
    };
  }, []);

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
  /* ── Chrome estilo Apple TV ───────────────────────────────────────────
     La barra vive ENCIMA del vídeo (overlay) y se esconde sola cuando nadie
     la toca: eso es lo que la hace leer como un reproductor de tvOS y no
     como un mando suelto debajo de una imagen. */
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  /** Hasta dónde hay descargado, para pintar la zona amortiguada del progreso. */
  const [bufferedEnd, setBufferedEnd] = useState(0);
  /** Qué desplegable flota sobre la barra: solo uno a la vez, como en tvOS. */
  const [openMenu, setOpenMenu] = useState<null | "version" | "audio" | "subs" | "speed">(null);
  const [isPip, setIsPip] = useState(false);
  /** Vista previa del tiempo al pasar por la barra, y si se está arrastrando. */
  const [scrubPreview, setScrubPreview] = useState<number | null>(null);
  const [seeking, setSeeking] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

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

  /* ── Lógica del chrome tipo Apple TV ─────────────────────────────────── */

  /** Enseña la barra y programa su escondite; en pausa o con menú no se esconde. */
  const wake = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }, []);

  useEffect(() => {
    if (!showControls) return;
    if (!isPlaying || openMenu !== null || hasError) return;
    hideTimer.current = setTimeout(() => setShowControls(false), OCULTAR_CONTROLES_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = null;
    };
  }, [showControls, isPlaying, openMenu, hasError, currentTime]);

  // Al cambiar de enlace se vuelve a enseñar todo y se cierra cualquier menú.
  useEffect(() => {
    setOpenMenu(null);
    setScrubPreview(null);
    setSeeking(false);
    setBufferedEnd(0);
    setPlaybackRate(1);
    wake();
  }, [stream?.url, wake]);

  /** Volumen, velocidad y PiP del propio <video>: si cambian fuera, aquí se refleja. */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const alVolumen = () => {
      setVolume(video.volume);
      setIsMuted(video.muted || video.volume === 0);
    };
    const alRitmo = () => setPlaybackRate(video.playbackRate);
    const alBuffer = () => {
      try {
        const n = video.buffered.length;
        if (n > 0) setBufferedEnd(video.buffered.end(n - 1));
      } catch {
        /* Algunos motores no exponen `buffered`: sin zona amortiguada y listo. */
      }
    };
    const alPip = () => setIsPip(document.pictureInPictureElement === video);
    video.addEventListener("volumechange", alVolumen);
    video.addEventListener("ratechange", alRitmo);
    video.addEventListener("progress", alBuffer);
    video.addEventListener("enterpictureinpicture", alPip);
    video.addEventListener("leavepictureinpicture", alPip);
    alVolumen();
    return () => {
      video.removeEventListener("volumechange", alVolumen);
      video.removeEventListener("ratechange", alRitmo);
      video.removeEventListener("progress", alBuffer);
      video.removeEventListener("enterpictureinpicture", alPip);
      video.removeEventListener("leavepictureinpicture", alPip);
    };
  }, [stream?.url]);

  const seekBy = useCallback(
    (delta: number) => {
      const video = videoRef.current;
      if (!video || !Number.isFinite(video.duration)) return;
      video.currentTime = Math.min(
        Math.max(0, video.currentTime + delta),
        video.duration || 0,
      );
      wake();
    },
    [wake],
  );

  const changeVolume = useCallback(
    (valor: number) => {
      const video = videoRef.current;
      if (!video) return;
      const v = Math.min(1, Math.max(0, valor));
      video.volume = v;
      video.muted = v === 0;
      wake();
    },
    [wake],
  );

  const changeSpeed = useCallback(
    (valor: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.playbackRate = valor;
      setPlaybackRate(valor);
      setOpenMenu(null);
      wake();
    },
    [wake],
  );

  const togglePip = useCallback(async () => {
    const video = videoRef.current as (HTMLVideoElement & {
      requestPictureInPicture?: () => Promise<void>;
    }) | null;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video.requestPictureInPicture?.();
    } catch {
      /* Sin PiP en este aparato: el botón ya se oculta cuando no hay soporte. */
    }
    wake();
  }, [wake]);

  /** Tiempo que corresponde a un punto de la barra de progreso. */
  const timeFromClientX = useCallback(
    (clientX: number) => {
      const barra = progressRef.current;
      const video = videoRef.current;
      if (!barra || !video || !Number.isFinite(video.duration) || video.duration <= 0) return 0;
      const rect = barra.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * video.duration;
    },
    [],
  );

  const alScrubDown = useCallback(
    (evento: React.PointerEvent) => {
      (evento.target as HTMLElement).setPointerCapture?.(evento.pointerId);
      setSeeking(true);
      const t = timeFromClientX(evento.clientX);
      setScrubPreview(t);
      seekTo(t);
      wake();
    },
    // `seekTo` se declara más arriba en el archivo original.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeFromClientX, wake],
  );

  const alScrubMove = useCallback(
    (evento: React.PointerEvent) => {
      const t = timeFromClientX(evento.clientX);
      setScrubPreview(t);
      if (seeking) seekTo(t);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeFromClientX, seeking],
  );

  const alScrubUp = useCallback(() => {
    setSeeking(false);
    // La previa se queda un instante para que se lea a dónde se saltó.
    window.setTimeout(() => setScrubPreview(null), 600);
    wake();
  }, [wake]);

  /**
   * Atajos de teclado cuando el foco está dentro del reproductor: espacio/K
   * pausa, J/L saltos de 10 s, flechas buscar/volumen, F pantalla completa,
   * M silencio. Igual que YouTube/tvOS: quien viene de otro reproductor no
   * tiene que aprender nada.
   */
  const alTecla = useCallback(
    (evento: React.KeyboardEvent) => {
      const objetivo = evento.target as HTMLElement | null;
      if (objetivo && ["INPUT", "SELECT", "TEXTAREA"].includes(objetivo.tagName)) return;
      switch (evento.key) {
        case " ":
        case "k":
        case "K":
          evento.preventDefault();
          togglePlay();
          wake();
          break;
        case "j":
        case "J":
          seekBy(-SALTO_S);
          break;
        case "l":
        case "L":
          seekBy(SALTO_S);
          break;
        case "ArrowLeft":
          evento.preventDefault();
          seekBy(-SALTO_S);
          break;
        case "ArrowRight":
          evento.preventDefault();
          seekBy(SALTO_S);
          break;
        case "ArrowUp":
          evento.preventDefault();
          changeVolume(volume + 0.1);
          break;
        case "ArrowDown":
          evento.preventDefault();
          changeVolume(volume - 0.1);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          wake();
          break;
        case "m":
        case "M":
          toggleMute();
          wake();
          break;
        case "Escape":
          setOpenMenu(null);
          break;
      }
    },
    [togglePlay, seekBy, changeVolume, volume, toggleFullscreen, toggleMute, wake],
  );

  const progresoPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferPct = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;
  const puedePip =
    typeof document !== "undefined" && "pictureInPictureEnabled" in document
      ? (document as Document & { pictureInPictureEnabled?: boolean }).pictureInPictureEnabled !== false
      : true;

  if (!stream) {
    return (
      <div className="player-sin-enlace">Esta ficha no tiene ningún enlace configurado.</div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={wake}
      onTouchStart={wake}
      onKeyDown={alTecla}
      className={`atv group relative aspect-video w-full overflow-hidden rounded-2xl bg-black select-none ${
        showControls ? "atv-activo" : "atv-oculto"
      }`}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        muted={isMuted}
        onClick={() => {
          togglePlay();
          wake();
        }}
        onDoubleClick={() => {
          toggleFullscreen();
          wake();
        }}
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
        <div className="pointer-events-none absolute inset-x-0 bottom-[22%] z-10 flex justify-center px-[5%]">
          <span className="atv-subtitulo">{subtitleText}</span>
        </div>
      )}

      {/* Cabecera flotante: título + estado, como la ficha de tvOS. */}
      <div className="atv-top">
        <div className="atv-top-titulo">
          <span className="atv-top-nombre">{title}</span>
          {streams.length > 1 && (
            <span className="atv-top-version">{streams[streamIndex]?.label}</span>
          )}
        </div>
        <div className="atv-top-marcas">
          {playbackRate !== 1 && (
            <span className="atv-marca">×{playbackRate}</span>
          )}
          {isCasting && <span className="atv-marca is-verde">En la TV</span>}
        </div>
      </div>

      {/* Fallo al transmitir. Antes solo se escribía en la consola, así que
          desde fuera parecía que el botón simplemente no hacía nada. */}
      {castError && showControls && (
        <div className="atv-alerta" role="status">
          <Cast aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
          <p className="flex-1">{castError}</p>
          <button
            data-nav="button"
            type="button"
            onClick={dismissCastError}
            aria-label="Cerrar aviso"
            className="atv-alerta-cerrar"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}

      {isLoading && !hasError && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center" role="status">
          <span className="atv-carga">
            <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin" />
          </span>
          <span className="sr-only">Cargando…</span>
        </div>
      )}

      {/* Pausa: botón central grande sobre fondo atenuado, como tvOS. */}
      {!isPlaying && !isLoading && !hasError && (
        <button
          data-nav="button"
          type="button"
          onClick={() => {
            togglePlay();
            wake();
          }}
          aria-label="Reproducir"
          className="atv-play-central"
        >
          <Play aria-hidden="true" className="ml-1 h-9 w-9 fill-current" />
        </button>
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

      {/* ── Barra inferior estilo Apple TV ─────────────────────────── */}
      {!hasError && (
        <div className="atv-barra">
          {/* El riel solo, sin el tiempo flanqueándolo: el tiempo vive en la
              fila de botones (a la derecha, junto a pantalla completa). */}
          <div className="atv-progreso-fila">
            <div
              ref={progressRef}
              data-nav="input"
              role="slider"
              tabIndex={0}
              aria-label="Posición de reproducción"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration || 0)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${formatTime(currentTime)} de ${formatTime(duration)}`}
              className="atv-riel"
              onPointerDown={alScrubDown}
              onPointerMove={alScrubMove}
              onPointerUp={alScrubUp}
              onPointerLeave={() => {
                if (!seeking) setScrubPreview(null);
              }}
              onKeyDown={(evento) => {
                if (evento.key === "ArrowLeft") {
                  evento.stopPropagation();
                  seekBy(-SALTO_S);
                } else if (evento.key === "ArrowRight") {
                  evento.stopPropagation();
                  seekBy(SALTO_S);
                } else if (evento.key === "Home") {
                  evento.stopPropagation();
                  seekTo(0);
                } else if (evento.key === "End" && Number.isFinite(duration)) {
                  evento.stopPropagation();
                  seekTo(duration);
                }
              }}
            >
              <div className="atv-riel-fondo" />
              <div className="atv-riel-buffer" style={{ width: `${bufferPct}%` }} />
              <div className="atv-riel-valor" style={{ width: `${progresoPct}%` }}>
                <span className="atv-riel-pomo" />
              </div>
              {scrubPreview !== null && duration > 0 && (
                <span
                  className="atv-riel-previa"
                  style={{ left: `${Math.min(100, (scrubPreview / duration) * 100)}%` }}
                >
                  {formatTime(scrubPreview)}
                </span>
              )}
            </div>
          </div>

          {/* Botonera */}
          <div className="atv-fila">
            <div className="atv-grupo">
              <button
                data-nav="button"
                type="button"
                onClick={() => seekBy(-SALTO_S)}
                aria-label={`Retroceder ${SALTO_S} segundos`}
                className="atv-btn"
              >
                <RotateCcw aria-hidden="true" className="h-5 w-5" />
              </button>

              <button
                data-nav="button"
                type="button"
                onClick={() => {
                  togglePlay();
                  wake();
                }}
                aria-label={isPlaying ? "Pausar" : "Reproducir"}
                className="atv-btn is-play"
              >
                {isPlaying ? (
                  <Pause aria-hidden="true" className="h-5 w-5 fill-current" />
                ) : (
                  <Play aria-hidden="true" className="ml-0.5 h-5 w-5 fill-current" />
                )}
              </button>

              <button
                data-nav="button"
                type="button"
                onClick={() => seekBy(SALTO_S)}
                aria-label={`Avanzar ${SALTO_S} segundos`}
                className="atv-btn"
              >
                <RotateCw aria-hidden="true" className="h-5 w-5" />
              </button>

              <div className="atv-volumen">
                <button
                  data-nav="button"
                  type="button"
                  onClick={() => {
                    toggleMute();
                    wake();
                  }}
                  aria-label={isMuted ? "Activar sonido" : "Silenciar"}
                  className="atv-btn"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <Volume2 aria-hidden="true" className="h-5 w-5" />
                  )}
                </button>
                <input
                  data-nav="input"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(evento) => changeVolume(Number(evento.target.value))}
                  aria-label="Volumen"
                  className="atv-volumen-riel"
                />
              </div>
            </div>

            <div className="atv-grupo is-derecha">
              <span className="atv-tiempo">
                {formatTime(scrubPreview ?? currentTime)}
                <span className="atv-tiempo-sep">/</span>
                {formatTime(duration)}
              </span>

              {/* Versiones del mismo título (doblajes, calidades) */}
              {streams.length > 1 && (
                <button
                  data-nav="button"
                  type="button"
                  onClick={() => setOpenMenu(openMenu === "version" ? null : "version")}
                  aria-label="Versión"
                  aria-expanded={openMenu === "version"}
                  className={`atv-btn ${openMenu === "version" ? "is-activo" : ""}`}
                >
                  <Languages aria-hidden="true" className="h-5 w-5" />
                </button>
              )}

              {/* Solo aparece si el archivo trae más de una pista de audio */}
              {audioTracks.length > 1 && (
                <button
                  data-nav="button"
                  type="button"
                  onClick={() => setOpenMenu(openMenu === "audio" ? null : "audio")}
                  aria-label="Pista de audio"
                  aria-expanded={openMenu === "audio"}
                  className={`atv-btn ${openMenu === "audio" ? "is-activo" : ""}`}
                >
                  <Languages aria-hidden="true" className="h-5 w-5" />
                  <span className="atv-punto" aria-hidden="true" />
                </button>
              )}

              {subtitles.length > 0 && (
                <button
                  data-nav="button"
                  type="button"
                  onClick={() => setOpenMenu(openMenu === "subs" ? null : "subs")}
                  aria-label="Subtítulos"
                  aria-pressed={activeSubtitle !== null}
                  aria-expanded={openMenu === "subs"}
                  className={`atv-btn ${openMenu === "subs" || activeSubtitle !== null ? "is-activo" : ""}`}
                >
                  <Captions aria-hidden="true" className="h-5 w-5" />
                </button>
              )}

              <button
                data-nav="button"
                type="button"
                onClick={() => setOpenMenu(openMenu === "speed" ? null : "speed")}
                aria-label={`Velocidad: ${playbackRate}×`}
                aria-expanded={openMenu === "speed"}
                className={`atv-btn ${openMenu === "speed" || playbackRate !== 1 ? "is-activo" : ""}`}
              >
                <Gauge aria-hidden="true" className="h-5 w-5" />
              </button>

              {/* Un botón por vía, no uno genérico: en Android aparece
                  Chromecast y en iOS AirPlay. Si no hay ninguna, ninguno. */}
              {castMethod === "gcast" && (
                <button
                  data-nav="button"
                  type="button"
                  onClick={isCasting ? stopCasting : startCasting}
                  aria-label={isCasting ? "Dejar de transmitir a la TV" : "Transmitir con Chromecast"}
                  aria-pressed={isCasting}
                  className={`atv-btn ${isCasting ? "is-verde" : ""}`}
                >
                  <Cast aria-hidden="true" className="h-5 w-5" />
                </button>
              )}

              {castMethod === "airplay" && (
                <button
                  data-nav="button"
                  type="button"
                  onClick={isCasting ? stopCasting : startCasting}
                  aria-pressed={isCasting}
                  aria-label={isCasting ? "Dejar de transmitir con AirPlay" : "Transmitir con AirPlay"}
                  className={`atv-btn ${isCasting ? "is-verde" : ""}`}
                >
                  <Airplay aria-hidden="true" className="h-5 w-5" />
                </button>
              )}

              {puedePip && (
                <button
                  data-nav="button"
                  type="button"
                  onClick={togglePip}
                  aria-label={isPip ? "Salir de imagen en imagen" : "Imagen en imagen"}
                  aria-pressed={isPip}
                  className={`atv-btn is-opcional ${isPip ? "is-activo" : ""}`}
                >
                  <PictureInPicture2 aria-hidden="true" className="h-5 w-5" />
                </button>
              )}

              {canFullscreen && (
                <button
                  data-nav="button"
                  type="button"
                  onClick={() => {
                    toggleFullscreen();
                    wake();
                  }}
                  aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                  className="atv-btn"
                >
                  {isFullscreen ? (
                    <Minimize aria-hidden="true" className="h-5 w-5" />
                  ) : (
                    <Maximize aria-hidden="true" className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Desplegables: un panel flotante, contenido según el botón. */}
          {openMenu !== null && (
            <div className="atv-menu" role="menu">
              {openMenu === "version" && (
                <>
                  <p className="atv-menu-titulo">Versión</p>
                  {streams.map((option, index) => (
                    <button
                      key={option.url}
                      data-nav="button"
                      type="button"
                      role="menuitemradio"
                      aria-checked={index === streamIndex}
                      onClick={() => {
                        setStreamIndex(index);
                        setOpenMenu(null);
                        wake();
                      }}
                      className={`atv-menu-item ${index === streamIndex ? "is-elegido" : ""}`}
                    >
                      <span className="flex-1 truncate text-left">{option.label}</span>
                      {index === streamIndex && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                    </button>
                  ))}
                </>
              )}
              {openMenu === "audio" && (
                <>
                  <p className="atv-menu-titulo">Audio</p>
                  {audioTracks.map((track) => (
                    <button
                      key={track.id}
                      data-nav="button"
                      type="button"
                      role="menuitemradio"
                      aria-checked={track.id === activeAudio}
                      onClick={() => {
                        selectAudio(track.id);
                        setOpenMenu(null);
                        wake();
                      }}
                      className={`atv-menu-item ${track.id === activeAudio ? "is-elegido" : ""}`}
                    >
                      <span className="flex-1 truncate text-left">{track.label}</span>
                      {track.id === activeAudio && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                    </button>
                  ))}
                </>
              )}
              {openMenu === "subs" && (
                <>
                  <p className="atv-menu-titulo">Subtítulos</p>
                  <button
                    data-nav="button"
                    type="button"
                    role="menuitemradio"
                    aria-checked={activeSubtitle === null}
                    onClick={() => {
                      setActiveSubtitle(null);
                      setOpenMenu(null);
                      wake();
                    }}
                    className={`atv-menu-item ${activeSubtitle === null ? "is-elegido" : ""}`}
                  >
                    <span className="flex-1 truncate text-left">Sin subtítulos</span>
                    {activeSubtitle === null && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                  </button>
                  {subtitles.map((track, index) => (
                    <button
                      key={track.url}
                      data-nav="button"
                      type="button"
                      role="menuitemradio"
                      aria-checked={index === activeSubtitle}
                      onClick={() => {
                        setActiveSubtitle(index);
                        setOpenMenu(null);
                        wake();
                      }}
                      className={`atv-menu-item ${index === activeSubtitle ? "is-elegido" : ""}`}
                    >
                      <span className="flex-1 truncate text-left">{track.label}</span>
                      {index === activeSubtitle && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                    </button>
                  ))}
                </>
              )}
              {openMenu === "speed" && (
                <>
                  <p className="atv-menu-titulo">Velocidad</p>
                  {VELOCIDADES.map((valor) => (
                    <button
                      key={valor}
                      data-nav="button"
                      type="button"
                      role="menuitemradio"
                      aria-checked={valor === playbackRate}
                      onClick={() => changeSpeed(valor)}
                      className={`atv-menu-item ${valor === playbackRate ? "is-elegido" : ""}`}
                    >
                      <span className="flex-1 truncate text-left">
                        {valor}×{valor === 1 ? " (normal)" : ""}
                      </span>
                      {valor === playbackRate && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default NativePlayer;
