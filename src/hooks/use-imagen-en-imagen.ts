"use client";

import { useCallback, useSyncExternalStore, type RefObject } from "react";
import {
  alternarImagenEnImagen,
  estaEnImagenEnImagen,
  EVENTOS_PIP,
  soportaImagenEnImagen,
  type DocumentoPip,
  type VideoPip,
} from "@/lib/imagen-en-imagen";

/**
 * Imagen en imagen para un `<video>`: si se puede, si está puesta y el botón.
 * Las reglas están en `lib/imagen-en-imagen.ts`.
 *
 * `clave` es lo que cambia cuando el `<video>` de la ref puede ser otro (el
 * canal, en el directo): con ella se vuelven a poner los oyentes.
 *
 * Con `useSyncExternalStore` y no con estado + efecto: el soporte y el estado
 * los sabe el navegador, y así se leen de él en vez de copiarlos a mano. En
 * el servidor no hay vídeo: `false`.
 */
export function useImagenEnImagen(videoRef: RefObject<HTMLVideoElement | null>, clave?: unknown) {
  const suscribir = useCallback(
    (avisar: () => void) => {
      const video = videoRef.current;
      if (!video) return () => {};
      for (const evento of EVENTOS_PIP) video.addEventListener(evento, avisar);
      return () => {
        for (const evento of EVENTOS_PIP) video.removeEventListener(evento, avisar);
      };
    },
    // `clave` no se lee dentro: está para volver a suscribirse a otro vídeo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [videoRef, clave],
  );

  // En la tele no: no hay otras apps sobre las que flotar, y algún Chromium
  // de tele dice tenerla sin tener ventana donde ponerla.
  const soportada = useSyncExternalStore(
    suscribir,
    () =>
      document.documentElement.dataset.pantalla !== "tv" &&
      soportaImagenEnImagen(videoRef.current as VideoPip | null, document as DocumentoPip),
    () => false,
  );
  const activa = useSyncExternalStore(
    suscribir,
    () => estaEnImagenEnImagen(videoRef.current as VideoPip | null, document as DocumentoPip),
    () => false,
  );

  const alternar = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await alternarImagenEnImagen(video as VideoPip, document as DocumentoPip);
    } catch {
      // Rechazada por el navegador (sin gesto, o el vídeo aún sin cargar): el
      // botón sigue ahí para volver a intentarlo.
    }
  }, [videoRef]);

  return { soportada, activa, alternar };
}
