"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Pantalla completa que funciona también en iPhone.
 *
 * Safari en iPhone NO implementa la Fullscreen API sobre elementos normales
 * (`document.fullscreenEnabled` es false y `requestFullscreen` no existe en un
 * div), que es justo por lo que el botón no hacía nada en el teléfono. Ahí la
 * única vía es `video.webkitEnterFullscreen()`, que abre el reproductor nativo
 * del sistema.
 *
 * Orden de intentos: estándar -> WebKit sobre el contenedor -> WebKit sobre el
 * <video> (iPhone). Si ninguna existe, `isSupported` es false y la UI esconde
 * el botón.
 */

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface FullscreenVideo extends HTMLVideoElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  /** Solo iPhone: abre el reproductor nativo a pantalla completa. */
  webkitEnterFullscreen?: () => void;
  webkitDisplayingFullscreen?: boolean;
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

export function useFullscreen(
  containerRef: React.RefObject<HTMLElement | null>,
  videoRef: React.RefObject<HTMLVideoElement | null>
) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const container = containerRef.current as FullscreenElement | null;
    const video = videoRef.current as FullscreenVideo | null;
    setIsSupported(
      Boolean(
        container?.requestFullscreen ||
          container?.webkitRequestFullscreen ||
          video?.webkitEnterFullscreen
      )
    );
  }, [containerRef, videoRef]);

  useEffect(() => {
    const doc = document as FullscreenDocument;
    const video = videoRef.current as FullscreenVideo | null;

    const syncFromDocument = () => {
      setIsFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    // En iPhone la salida no dispara fullscreenchange: hay eventos propios.
    const handleEnterNative = () => setIsFullscreen(true);
    const handleExitNative = () => setIsFullscreen(false);

    document.addEventListener("fullscreenchange", syncFromDocument);
    document.addEventListener("webkitfullscreenchange", syncFromDocument);
    video?.addEventListener("webkitbeginfullscreen", handleEnterNative);
    video?.addEventListener("webkitendfullscreen", handleExitNative);

    return () => {
      document.removeEventListener("fullscreenchange", syncFromDocument);
      document.removeEventListener("webkitfullscreenchange", syncFromDocument);
      video?.removeEventListener("webkitbeginfullscreen", handleEnterNative);
      video?.removeEventListener("webkitendfullscreen", handleExitNative);
    };
  }, [videoRef]);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;
    const container = containerRef.current as FullscreenElement | null;
    const video = videoRef.current as FullscreenVideo | null;

    // Salir
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      try {
        await (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } catch {
        // Algunos navegadores rechazan si ya se salió por gesto del usuario.
      }
      return;
    }
    if (video?.webkitDisplayingFullscreen) {
      (video as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen?.();
      return;
    }

    // Entrar. Preferimos el contenedor para conservar nuestros controles encima.
    //
    // Antes, si esta llamada fallaba (algunos navegadores de TV la rechazan
    // sobre un <div> normal, solo la aceptan sobre <html>), el error se
    // TRAGABA en un catch vacío y se caía directo al modo nativo del
    // <video> — que en Chrome/TV no existe, así que no pasaba nada visible
    // salvo el vídeo agrandándose por CSS, con la barra del navegador
    // seguía ahí. Ahora, si el contenedor falla, se reintenta sobre
    // `document.documentElement`: eso es lo que de verdad oculta el marco
    // del navegador en una televisión.
    try {
      if (container?.requestFullscreen) {
        await container.requestFullscreen();
        return;
      }
      if (container?.webkitRequestFullscreen) {
        await container.webkitRequestFullscreen();
        return;
      }
    } catch {
      // Sigue al respaldo de abajo en vez de darse por vencido aquí.
    }

    try {
      const root = document.documentElement as FullscreenElement;
      if (root.requestFullscreen) {
        await root.requestFullscreen();
        return;
      }
      if (root.webkitRequestFullscreen) {
        await root.webkitRequestFullscreen();
        return;
      }
    } catch {
      // Cae al modo nativo del <video>, último recurso y solo real en iPhone.
    }

    // iPhone: única vía posible; abre el reproductor del sistema.
    if (video?.webkitEnterFullscreen) {
      try {
        video.webkitEnterFullscreen();
      } catch {
        // Solo funciona tras cargar metadatos; el usuario puede reintentar.
      }
    }
  }, [containerRef, videoRef]);

  return { isFullscreen, isSupported, toggleFullscreen };
}
