"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Transmitir el canal a una TV desde el teléfono, cubriendo las tres vías que
 * existen en navegadores, en orden de preferencia:
 *
 * 1. **Google Cast** (Chrome de escritorio y Android): se manda la URL del
 *    stream al receptor, así que funciona aunque localmente reproduzcamos con
 *    hls.js/MSE (que no se puede transmitir tal cual).
 * 2. **AirPlay** (Safari / iOS): `webkitShowPlaybackTargetPicker`.
 * 3. **Remote Playback API**: respaldo estándar donde exista.
 *
 * Si no hay ninguna disponible, `isAvailable` queda en false y la UI oculta el
 * botón en vez de mostrar algo que no funciona.
 */

const CAST_SDK_URL = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
// Receptor multimedia por defecto de Google: reproduce HLS/MP4 sin registrar app.
const DEFAULT_RECEIVER_APP_ID = "CC1AD845";

type CastMethod = "gcast" | "airplay" | "remote";

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
      media: {
        MediaInfo: new (contentId: string, contentType: string) => MediaInfo;
        LoadRequest: new (mediaInfo: MediaInfo) => LoadRequest;
        StreamType: { LIVE: string };
      };
    };
  };
  __onGCastApiAvailable?: (isAvailable: boolean) => void;
}

interface MediaInfo {
  contentType: string;
  streamType?: string;
  metadata?: unknown;
}
interface LoadRequest {
  media: MediaInfo;
}
interface CastSession {
  loadMedia(request: LoadRequest): Promise<void>;
  /** `true` detiene también la reproducción en el receptor. */
  endSession(stopCasting: boolean): void;
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

/** Cerrar el selector de pantallas no es un error que merezca avisar. */
function isCancellation(error: unknown): boolean {
  const code = (error as { code?: string })?.code ?? String(error ?? "");
  return /cancel/i.test(code);
}

/**
 * Tipo de contenido para el receptor. Casi toda la lista es HLS, pero mandar
 * `x-mpegurl` para un MPD hace que el receptor lo rechace, y ese rechazo es
 * justo lo que dejaba la sesión colgada.
 */
function contentTypeFor(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".mpd")) return "application/dash+xml";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".webm")) return "video/webm";
  return "application/x-mpegurl";
}

export function useCast(videoRef: React.RefObject<HTMLVideoElement | null>, streamUrl: string, channelName: string) {
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
    if (!video || typeof video.webkitShowPlaybackTargetPicker !== "function") return;

    const handleAvailability = (event: Event) => {
      const available = (event as Event & { availability?: string }).availability === "available";
      setMethod((current) => (available ? "airplay" : current === "airplay" ? null : current));
    };

    video.addEventListener("webkitplaybacktargetavailabilitychanged", handleAvailability);
    // Algunos WebKit no emiten el evento hasta que hay media; ofrecerlo igual es
    // preferible a esconder el botón en un iPhone que sí tiene AirPlay.
    setMethod((current) => current ?? "airplay");

    return () => video.removeEventListener("webkitplaybacktargetavailabilitychanged", handleAvailability);
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
          setMethod((current) =>
            state === framework.CastState.NO_DEVICES_AVAILABLE ? (current === "gcast" ? null : current) : "gcast"
          );
          setIsCasting(state === framework.CastState.CONNECTED);
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

    return () => {
      if (cancelId !== undefined) video.remote?.cancelWatchAvailability(cancelId).catch(() => {});
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
        if (isCancellation(error)) return;
        // Una sesión a medias impediría volver a abrir el selector.
        discardSession(context);
        setError("No se pudo conectar con la pantalla. Revisa que esté encendida y en la misma red.");
        return;
      }

      try {
        const mediaInfo = new media.MediaInfo(streamUrl, contentTypeFor(streamUrl));
        mediaInfo.streamType = media.StreamType.LIVE;
        mediaInfo.metadata = { title: channelName };
        await session.loadMedia(new media.LoadRequest(mediaInfo));
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
        console.warn("No se pudo transmitir con Google Cast:", error);
        setError("Esa pantalla no pudo abrir este canal. Prueba otra vez o elige otra pantalla.");
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
  }, [method, streamUrl, channelName, videoRef, restoreLocalAudio]);

  /** Cortar la transmisión y recuperar el vídeo en el teléfono. */
  const stopCasting = useCallback(() => {
    setError(null);
    if (contextRef.current) discardSession(contextRef.current);
    restoreLocalAudio(videoRef.current);
    setIsCasting(false);
  }, [restoreLocalAudio, videoRef]);

  // Si la transmisión termina por fuera (se apaga la TV, alguien la corta desde
  // otro móvil), hay que devolver el sonido igualmente.
  useEffect(() => {
    if (!isCasting) restoreLocalAudio(videoRef.current);
  }, [isCasting, restoreLocalAudio, videoRef]);

  return {
    canCast: method !== null,
    isCasting,
    startCasting,
    stopCasting,
    castError: error,
    dismissCastError: useCallback(() => setError(null), []),
  };
}
