"use client";

import { useEffect, type RefObject } from "react";
import { PANTALLA_ENCENDIDA_MS, destinoDeSalto, metadatosDe, posicionDe } from "@/lib/reproduccion/sesion-medios";

const SALTO_S = 10;

/**
 * La película, en la pantalla de bloqueo: título, carátula, ±10 s y la barra
 * de avance (play y pausa los pone el propio navegador). También responde a
 * los auriculares.
 *
 * No manda nada por su cuenta: mueve el `<video>`, y quien escucha al vídeo
 * —la sala de «Ver juntos»— hace lo demás. Pausar desde la pantalla de
 * bloqueo pausa a todos, igual que pausar con el botón.
 *
 * Donde el navegador no lo trae (teles viejas), no hace nada.
 */
export function useSesionDeMedios(videoRef: RefObject<HTMLVideoElement | null>, titulo: string, caratula?: string | null, activo = true) {
  useEffect(() => {
    const video = videoRef.current;
    if (!activo || !video || typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const sesion = navigator.mediaSession;

    const poner = (accion: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        sesion.setActionHandler(accion, fn);
      } catch {
        // Este navegador no conoce esa acción: las demás siguen valiendo.
      }
    };
    const contarPosicion = () => {
      const posicion = posicionDe(video.duration, video.currentTime, video.playbackRate);
      if (!posicion) return;
      try {
        sesion.setPositionState(posicion);
      } catch {
        // Sin barra de avance en la pantalla de bloqueo; lo demás funciona.
      }
    };
    const contarEstado = () => {
      sesion.playbackState = video.paused ? "paused" : "playing";
      contarPosicion();
    };

    if (typeof MediaMetadata !== "undefined") sesion.metadata = new MediaMetadata(metadatosDe(titulo, caratula));
    /*
     * Play y pausa NO se registran: el navegador ya los ofrece por su cuenta
     * para el vídeo que suena. Un manejador propio sería un camino más por el
     * que un play del sistema que nadie pulsó (el fin de una llamada, otra
     * app que deja de sonar) arrancaría la película a toda la sala.
     */
    poner("seekbackward", (d) => {
      video.currentTime = destinoDeSalto(video.currentTime, video.duration, -(d.seekOffset || SALTO_S));
    });
    poner("seekforward", (d) => {
      video.currentTime = destinoDeSalto(video.currentTime, video.duration, d.seekOffset || SALTO_S);
    });
    poner("seekto", (d) => {
      if (typeof d.seekTime === "number") video.currentTime = destinoDeSalto(d.seekTime, video.duration, 0);
    });

    const eventos = ["play", "pause", "seeked", "ratechange", "durationchange"] as const;
    for (const e of eventos) video.addEventListener(e, contarEstado);
    contarEstado();

    return () => {
      for (const e of eventos) video.removeEventListener(e, contarEstado);
      for (const accion of ["seekbackward", "seekforward", "seekto"] as const) poner(accion, null);
      sesion.metadata = null;
      sesion.playbackState = "none";
    };
  }, [videoRef, titulo, caratula, activo]);
}

/**
 * Que la pantalla no se apague mientras `activo` (Wake Lock).
 *
 * Con la película en marcha el navegador ya la mantiene encendida. Esto es
 * para lo demás: la sala en pausa mientras alguien va por agua, o esperando a
 * que entre la otra persona. Cada cambio de `renovar` vuelve a empezar la
 * cuenta; pasado `PANTALLA_ENCENDIDA_MS` sin cambios, se suelta.
 *
 * El sistema lo retira solo al cambiar de app: se vuelve a pedir al volver.
 * Donde no existe, o con el ahorro de batería activado, no hace nada.
 */
export function useMantenerPantalla(activo: boolean, renovar: unknown = null) {
  useEffect(() => {
    if (!activo || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let cerrojo: WakeLockSentinel | null = null;
    let vivo = true;

    const pedir = async () => {
      if (!vivo || cerrojo || document.visibilityState !== "visible") return;
      try {
        const nuevo = await navigator.wakeLock.request("screen");
        if (!vivo) {
          void nuevo.release().catch(() => {});
          return;
        }
        cerrojo = nuevo;
        nuevo.addEventListener("release", () => {
          if (cerrojo === nuevo) cerrojo = null;
        });
      } catch {
        // Batería baja o permiso negado: la pantalla se apagará como siempre.
      }
    };
    const soltar = () => {
      const actual = cerrojo;
      cerrojo = null;
      void actual?.release().catch(() => {});
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") void pedir();
    };

    void pedir();
    document.addEventListener("visibilitychange", alVolver);
    const caduca = window.setTimeout(() => {
      vivo = false;
      soltar();
    }, PANTALLA_ENCENDIDA_MS);
    return () => {
      vivo = false;
      window.clearTimeout(caduca);
      document.removeEventListener("visibilitychange", alVolver);
      soltar();
    };
  }, [activo, renovar]);
}
