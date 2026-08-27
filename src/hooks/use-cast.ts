"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  describirErrorCast,
  emisionTrasEstado,
  esCancelacion,
  esHls,
  formatoHls,
  tipoDeContenido,
  type EstadoCast,
} from "@/lib/reproduccion/cast";

/**
 * API privada de WebKit para AirPlay; no existe en lib.dom y solo está en
 * Safari / iOS. Se declara aquí porque este hook es su único consumidor.
 */
declare global {
  interface Window {
    WebKitPlaybackTargetAvailabilityEvent?: unknown;
  }
}

/**
 * Transmitir el canal a una TV, por las tres vías que existen en navegadores y
 * en orden de preferencia:
 *
 * 1. **Google Cast** (Chrome, Android): se manda la URL al receptor, así que
 *    va aunque aquí se reproduzca con hls.js/MSE, que no se puede transmitir.
 * 2. **AirPlay** (Safari/iOS): `webkitShowPlaybackTargetPicker`.
 * 3. **Remote Playback API**, donde exista.
 *
 * Sin ninguna, el método queda en `null` y la UI esconde el botón en vez de
 * enseñar algo que no funciona.
 */

const CAST_SDK_URL = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
// Receptor multimedia por defecto de Google: reproduce HLS/MP4 sin registrar app.
const DEFAULT_RECEIVER_APP_ID = "CC1AD845";

export type CastMethod = "gcast" | "airplay" | "remote";

/** Un subtítulo que puede viajar hasta el receptor de Google Cast. */
export interface SubtituloCast {
  url: string;
  label: string;
  /** Código BCP 47, ej. "es". */
  lang: string;
  porDefecto?: boolean;
}

/**
 * Activa (o apaga con `trackId` nulo) la pista de subtítulos en el receptor.
 *
 * Las pistas se declaran en el `MediaInfo` antes de `loadMedia`, pero es esta
 * llamada —sobre la reproducción ya cargada— la que decide cuál se ve. Fallar
 * aquí no justifica cortar la emisión: solo se apunta en consola.
 */
function activarSubtituloEnReceptor(
  sesionMedia: CastMediaDelReceptor | null | undefined,
  trackId: number | null,
): void {
  const globals = window as unknown as CastGlobals;
  const media = globals.chrome?.cast?.media;
  if (!media || !sesionMedia?.editTracksInfo) return;
  try {
    sesionMedia.editTracksInfo(
      new media.EditTracksInfoRequest({ activeTrackIds: trackId == null ? [] : [trackId] }),
      () => {},
      () => console.warn("El receptor rechazó la pista de subtítulos"),
    );
  } catch {
    // Receptor sin soporte de pistas de texto: no rompe nada visible.
  }
}

interface CastGlobals {
  cast?: {
    framework?: {
      CastContext: { getInstance(): CastContext };
      CastContextEventType: { CAST_STATE_CHANGED: string };
      CastState: { NO_DEVICES_AVAILABLE: string; CONNECTED: string };
    };
  };
  chrome?: {
    cast?: {
      AutoJoinPolicy: { ORIGIN_SCOPED: string };
      media: CastMediaApi;
    };
  };
  __onGCastApiAvailable?: (isAvailable: boolean) => void;
}

/** El espacio de nombres `chrome.cast.media`, solo con lo que se usa aquí. */
interface CastMediaApi {
  MediaInfo: new (contentId: string, contentType: string) => MediaInfo;
  LoadRequest: new (mediaInfo: MediaInfo) => LoadRequest;
  StreamType: { LIVE: string; BUFFERED: string };
  Track: new (trackId: number, type: string) => CastTrack;
  TrackType: { TEXT: string };
  TextTrackType: { SUBTITLES: string };
  EditTracksInfoRequest: new (info: { activeTrackIds?: number[] }) => CastEditTracksInfo;
  /** Metadatos con forma; un objeto suelto no la tiene. */
  GenericMediaMetadata?: new () => CastMetadata;
  /** Enums de HLS; no están en SDK viejos, de ahí el `?`. Ver `formatoHls` en `lib/reproduccion/cast.ts`. */
  HlsSegmentFormat?: Record<string, string>;
  HlsVideoSegmentFormat?: Record<string, string>;
}

interface MediaInfo {
  contentType: string;
  streamType?: string;
  metadata?: unknown;
  /** Pistas de texto declaradas antes de `loadMedia`; sin ellas el receptor no ofrece subtítulos. */
  tracks?: CastTrack[];
  /** Contenedor de los fragmentos HLS. Ver `formatoHls` en `lib/reproduccion/cast.ts`. */
  hlsSegmentFormat?: string;
  hlsVideoSegmentFormat?: string;
}
/** Metadatos con `metadataType`, que es lo que el receptor sabe leer. */
interface CastMetadata {
  title?: string;
}
interface LoadRequest {
  media: MediaInfo;
}
/** Pista de subtítulo tal y como la quiere el receptor. */
interface CastTrack {
  trackContentId?: string;
  trackContentType?: string;
  name?: string;
  language?: string;
  subtype?: string;
}
interface CastEditTracksInfo {
  activeTrackIds?: number[];
}
/** La reproducción concreta dentro de la sesión; es quien activa las pistas. */
interface CastMediaDelReceptor {
  editTracksInfo(request: CastEditTracksInfo, ok: () => void, fallo: (error: unknown) => void): void;
}
interface CastSession {
  loadMedia(request: LoadRequest): Promise<void>;
  /** `true` detiene también la reproducción en el receptor. */
  endSession(stopCasting: boolean): void;
  getMediaSession(): CastMediaDelReceptor | null;
}
interface CastContext {
  setOptions(options: { receiverApplicationId: string; autoJoinPolicy: string }): void;
  requestSession(): Promise<void>;
  getCurrentSession(): CastSession | null;
  getCastState(): string;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface VideoWithAirplay extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
  /** `true` mientras la imagen va a un AirPlay. WebKit lo mantiene al día. */
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}

let castSdkPromise: Promise<boolean> | null = null;

/** Carga el SDK de Google Cast una sola vez. Resuelve false si no está disponible. */
function loadCastSdk(): Promise<boolean> {
  if (castSdkPromise) return castSdkPromise;

  castSdkPromise = new Promise<boolean>((resolve) => {
    const globals = window as unknown as CastGlobals;
    if (globals.cast?.framework) {
      resolve(true);
      return;
    }
    // El SDK solo existe en navegadores basados en Chromium.
    if (!("chrome" in window)) {
      resolve(false);
      return;
    }

    /**
     * **Chromecast exige un origen seguro**: sin él el SDK carga pero no
     * descubre nada. Se avisa en consola porque el síntoma desconcierta —va
     * por `https://` y no por `http://192.168.x.x:3000`—: parece la red y es
     * el protocolo.
     */
    if (!window.isSecureContext) {
      console.warn(
        "Chromecast necesita https (o localhost). Abierta por http, esta página no podrá transmitir.",
      );
      resolve(false);
      return;
    }

    const timeout = setTimeout(() => resolve(false), 8000);
    globals.__onGCastApiAvailable = (isAvailable: boolean) => {
      clearTimeout(timeout);
      resolve(Boolean(isAvailable));
    };

    const script = document.createElement("script");
    script.src = CAST_SDK_URL;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return castSdkPromise;
}

/**
 * Cierra la sesión y la olvida.
 *
 * Es la pieza que faltaba: el SDK deja la sesión viva aunque la carga del medio
 * haya fallado, y mientras exista, `requestSession()` no vuelve a abrir el
 * selector de pantallas. Sin esto, un solo fallo dejaba el botón muerto hasta
 * recargar la página.
 */
function discardSession(context: CastContext): void {
  try {
    context.getCurrentSession()?.endSession(true);
  } catch {
    // Ya estaba cerrada; da igual, el objetivo es que no quede ninguna viva.
  }
}

/** Identidad estable para los canales que no traen subtítulos. */
const SIN_SUBTITULOS: SubtituloCast[] = [];

export function useCast(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  streamUrl: string,
  channelName: string,
  opciones: {
    /** El directo no se puede buscar en el receptor; una peli sí. */
    enVivo?: boolean;
    /** Subtítulos que viajan declarados en el `MediaInfo` del receptor. */
    subtitulos?: SubtituloCast[];
    /** Cuál está elegido en nuestra UI; si no hay, el marcado por defecto. */
    subtituloActivo?: number | null;
  } = {},
) {
  const { enVivo = true, subtitulos = SIN_SUBTITULOS, subtituloActivo = null } = opciones;
  const [method, setMethod] = useState<CastMethod | null>(null);
  const [isCasting, setIsCasting] = useState(false);
  /** Último fallo, en texto para la persona que está delante de la tele. */
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<CastContext | null>(null);
  /** Si el vídeo ya estaba silenciado antes de transmitir, se respeta al volver. */
  const wasMutedRef = useRef(false);

  // AirPlay: Safari avisa por evento cuándo hay un dispositivo al alcance.
  useEffect(() => {
    const video = videoRef.current as VideoWithAirplay | null;
    if (!video) return;

    // Señal de que este WebKit sabe de AirPlay: la API de eventos de
    // disponibilidad y el selector nativo. El botón solo se ofrece si están
    // las dos; en Chrome ninguna existe y no se pinta nada que no funcione.
    const conoceAirplay =
      typeof window.WebKitPlaybackTargetAvailabilityEvent !== "undefined" &&
      typeof video.webkitShowPlaybackTargetPicker === "function";
    if (!conoceAirplay) return;

    const handleAvailability = (event: Event) => {
      const available = (event as Event & { availability?: string }).availability === "available";
      setMethod((current) => (available ? "airplay" : current === "airplay" ? null : current));
    };

    /**
     * Si la imagen va de verdad a un AirPlay. Sin esto `isCasting` solo lo
     * movía Google Cast y en AirPlay quedaba en `false` para siempre: la
     * pantalla no cambiaba nada al elegir la tele, ni había cómo cortar. Es lo
     * reportado como «salen los dispositivos pero no los manda».
     */
    const handleWireless = () => setIsCasting(Boolean(video.webkitCurrentPlaybackTargetIsWireless));

    video.addEventListener("webkitplaybacktargetavailabilitychanged", handleAvailability);
    video.addEventListener("webkitcurrentplaybacktargetiswirelesschanged", handleWireless);
    handleWireless();
    // Algunos WebKit no emiten el evento hasta que hay media; ofrecerlo igual es
    // preferible a esconder el botón en un iPhone que sí tiene AirPlay.
    setMethod((current) => current ?? "airplay");

    return () => {
      video.removeEventListener("webkitplaybacktargetavailabilitychanged", handleAvailability);
      video.removeEventListener("webkitcurrentplaybacktargetiswirelesschanged", handleWireless);
    };
  }, [videoRef]);

  // Google Cast.
  useEffect(() => {
    let cancelled = false;

    loadCastSdk().then((available) => {
      if (cancelled || !available) return;
      const globals = window as unknown as CastGlobals;
      const framework = globals.cast?.framework;
      const chromeCast = globals.chrome?.cast;
      if (!framework || !chromeCast) return;

      try {
        const context = framework.CastContext.getInstance();
        context.setOptions({
          receiverApplicationId: DEFAULT_RECEIVER_APP_ID,
          autoJoinPolicy: chromeCast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
        contextRef.current = context;

        const syncState = () => {
          const state = context.getCastState();
          const sinPantallas = state === framework.CastState.NO_DEVICES_AVAILABLE;
          setMethod((current) => (sinPantallas ? (current === "gcast" ? null : current) : "gcast"));

          // Aquí **solo se apaga**; encenderlo es cosa de `loadMedia`. El
          // porqué, con el fallo que provocaba, está en `emisionTrasEstado`.
          const estado: EstadoCast = sinPantallas
            ? "sin-pantallas"
            : state === framework.CastState.CONNECTED
              ? "conectado"
              : "no-conectado";
          setIsCasting((emitiendo) => emisionTrasEstado(emitiendo, estado));
        };
        syncState();
        context.addEventListener(framework.CastContextEventType.CAST_STATE_CHANGED, syncState);
      } catch (error) {
        console.warn("No se pudo inicializar Google Cast:", error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Remote Playback API como respaldo genérico.
  useEffect(() => {
    const video = videoRef.current;
    if (!video?.remote || typeof video.remote.watchAvailability !== "function") return;

    let cancelId: number | undefined;
    video.remote
      .watchAvailability((available) => {
        setMethod((current) => (available ? current ?? "remote" : current === "remote" ? null : current));
      })
      .then((id) => {
        cancelId = id;
      })
      .catch(() => {
        // Algunos navegadores lo rechazan si el media usa MSE: no es un error real.
      });

    // Igual que en AirPlay: sin escuchar la conexión, `isCasting` no se movía
    // nunca por esta vía y el botón no daba ninguna señal de estar emitiendo.
    const alConectar = () => setIsCasting(true);
    const alDesconectar = () => setIsCasting(false);
    video.remote.addEventListener("connect", alConectar);
    video.remote.addEventListener("disconnect", alDesconectar);
    setIsCasting(video.remote.state === "connected");

    return () => {
      if (cancelId !== undefined) video.remote?.cancelWatchAvailability(cancelId).catch(() => {});
      video.remote?.removeEventListener("connect", alConectar);
      video.remote?.removeEventListener("disconnect", alDesconectar);
    };
  }, [videoRef, streamUrl]);

  /**
   * Devuelve el sonido al teléfono al dejar de transmitir.
   *
   * Antes no se hacía: tras un intento fallido el vídeo quedaba silenciado para
   * siempre, así que además de no verse en la tele, tampoco se oía en el
   * teléfono. Se respeta el estado previo por si estaba silenciado a propósito.
   */
  const restoreLocalAudio = useCallback(
    (video: HTMLVideoElement | null) => {
      if (video) video.muted = wasMutedRef.current;
    },
    []
  );

  const startCasting = useCallback(async () => {
    const video = videoRef.current as VideoWithAirplay | null;
    setError(null);

    if (method === "gcast" && contextRef.current) {
      const globals = window as unknown as CastGlobals;
      const media = globals.chrome?.cast?.media;
      if (!media) return;

      const context = contextRef.current;
      let session: CastSession | null = null;

      try {
        // Se pide sesión solo si no hay ninguna; si la hay se reutiliza para no
        // volver a preguntar la pantalla en cada canal.
        if (!context.getCurrentSession()) await context.requestSession();
        session = context.getCurrentSession();
        if (!session) return;
      } catch (error) {
        // Cerrar el selector no es un fallo: no hay nada que avisar.
        if (esCancelacion(error)) return;
        // Una sesión a medias impediría volver a abrir el selector.
        discardSession(context);
        setIsCasting(false);
        /**
         * Se enseña el código del SDK, no un «revisa la red»: cuando esto
         * falla casi nunca es la tele, es que el teléfono y el Chromecast no
         * se ven —aislamiento de clientes del router, 5 GHz contra 2,4 sin
         * reenvío de mDNS, una VPN—. El código lo distingue.
         */
        setError(
          `No se pudo conectar con la pantalla. ${describirErrorCast(error)} ` +
            "Suele ser que el teléfono y el Chromecast no se ven en la red: mira que estén en la " +
            "misma wifi (no en la de invitados), que el teléfono no tenga una VPN activa y que el " +
            "router no tenga activado el aislamiento de clientes.",
        );
        return;
      }

      try {
        const contentType = tipoDeContenido(streamUrl);
        const mediaInfo = new media.MediaInfo(streamUrl, contentType);
        // El directo es LIVE; una peli o serie va BUFFERED para que el mando
        // pueda buscar dentro de ella desde el receptor.
        mediaInfo.streamType = enVivo ? media.StreamType.LIVE : media.StreamType.BUFFERED;
        // Con HLS hay que decirle el contenedor de los fragmentos o no carga.
        if (esHls(contentType)) {
          const formato = formatoHls(media.HlsSegmentFormat, media.HlsVideoSegmentFormat);
          mediaInfo.hlsSegmentFormat = formato.segmento;
          mediaInfo.hlsVideoSegmentFormat = formato.video;
        }
        /**
         * Metadatos CON FORMA, no un objeto suelto. `{ title }` a secas no
         * lleva `metadataType`, y el receptor descarta lo que no reconoce:
         * el título nunca llegaba a verse en la tele.
         */
        if (media.GenericMediaMetadata) {
          const metadatos = new media.GenericMediaMetadata();
          metadatos.title = channelName;
          mediaInfo.metadata = metadatos;
        } else {
          mediaInfo.metadata = { title: channelName };
        }
        /**
         * Los subtítulos viajan como pistas de texto del `MediaInfo`: sin
         * esto el receptor reproduce la peli muda de letras —el fallo que
         * se veía en las TVs—. Se activa después la elegida (o la marcada
         * por defecto); declararlas no basta para que se vean.
         */
        if (subtitulos.length > 0) {
          mediaInfo.tracks = subtitulos.map((subtitulo, indice) => {
            const pista = new media.Track(indice + 1, media.TrackType.TEXT);
            pista.trackContentId = subtitulo.url;
            pista.trackContentType = "text/vtt";
            pista.name = subtitulo.label;
            pista.language = subtitulo.lang || undefined;
            pista.subtype = media.TextTrackType.SUBTITLES;
            return pista;
          });
        }
        await session.loadMedia(new media.LoadRequest(mediaInfo));
        // Solo AQUÍ se enciende: hay medio cargado en el receptor. Ver la nota
        // de `syncState`, que es quien lo apaga.
        setIsCasting(true);
        const elegido =
          subtituloActivo ?? subtitulos.findIndex((subtitulo) => subtitulo.porDefecto);
        activarSubtituloEnReceptor(session.getMediaSession(), elegido >= 0 ? elegido + 1 : null);
        // El receptor toma el audio: silenciamos el local para no oír doble.
        if (video) {
          wasMutedRef.current = video.muted;
          video.muted = true;
        }
      } catch (error) {
        // ESTE es el punto que dejaba la app inservible: si loadMedia falla, la
        // sesión se queda ABIERTA. Como el intento siguiente ve que ya hay
        // sesión, nunca vuelve a llamar a requestSession() y el selector de
        // pantallas no aparece nunca más — parece que la app se colgó. Cerrarla
        // devuelve todo al estado inicial y el siguiente toque vuelve a
        // preguntar a qué TV enviar.
        discardSession(context);
        restoreLocalAudio(video);
        // Sin esto el botón se quedaba en «Dejar de transmitir» sin haber
        // transmitido nada, y el siguiente toque cerraba una sesión muerta en
        // vez de volver a preguntar a qué pantalla enviar.
        setIsCasting(false);
        console.warn("No se pudo transmitir con Google Cast:", error);
        setError(describirErrorCast(error));
      }
      return;
    }

    if (method === "airplay" && video?.webkitShowPlaybackTargetPicker) {
      video.webkitShowPlaybackTargetPicker();
      return;
    }

    if (method === "remote" && video?.remote) {
      try {
        await video.remote.prompt();
      } catch {
        // El usuario cerró el selector: no hay nada que reportar.
      }
    }
  }, [method, streamUrl, channelName, videoRef, restoreLocalAudio, enVivo, subtitulos, subtituloActivo]);

  /**
   * Cambiar de subtítulo MIENTRAS se emite también llega al receptor: sin
   * esto, la elección hecha al arrancar quedaría congelada en la tele hasta
   * volver a transmitir.
   */
  useEffect(() => {
    if (!isCasting || method !== "gcast" || !contextRef.current) return;
    const elegido = subtituloActivo ?? subtitulos.findIndex((subtitulo) => subtitulo.porDefecto);
    activarSubtituloEnReceptor(
      contextRef.current.getCurrentSession()?.getMediaSession(),
      elegido >= 0 ? elegido + 1 : null,
    );
  }, [isCasting, method, subtituloActivo, subtitulos]);

  /** Cortar la transmisión y recuperar el vídeo en el teléfono. */
  const stopCasting = useCallback(() => {
    setError(null);
    const video = videoRef.current as VideoWithAirplay | null;

    // AirPlay y Remote Playback no se cortan cerrando una sesión nuestra: se
    // corta desde donde se eligió la pantalla. Sin esto el botón encendido no
    // tenía forma de apagarse, que es media función que faltaba.
    if (method === "airplay") {
      video?.webkitShowPlaybackTargetPicker?.();
      return;
    }
    if (method === "remote" && video?.remote) {
      void video.remote.prompt().catch(() => {});
      return;
    }

    if (contextRef.current) discardSession(contextRef.current);
    restoreLocalAudio(video);
    setIsCasting(false);
  }, [method, restoreLocalAudio, videoRef]);

  // Si la transmisión termina por fuera (se apaga la TV, alguien la corta desde
  // otro móvil), hay que devolver el sonido igualmente.
  useEffect(() => {
    if (!isCasting) restoreLocalAudio(videoRef.current);
  }, [isCasting, restoreLocalAudio, videoRef]);

  return {
    /** Qué vía hay disponible: la UI la usa para pintar el botón que toca. */
    castMethod: method,
    isCasting,
    startCasting,
    stopCasting,
    castError: error,
    dismissCastError: useCallback(() => setError(null), []),
  };
}
