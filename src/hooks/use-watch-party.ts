"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { normalizeRoomId } from "@/lib/watch-party/sign";

/**
 * Watch Party: sincroniza play, pausa y posición entre varios navegadores.
 *
 * Decisiones que importan:
 *
 * - **Client events sobre canal privado.** Los mensajes van de navegador a
 *   navegador a través de Pusher, sin pasar por nuestro servidor: cero coste
 *   por evento y menos latencia. Requiere activar "Enable client events" en el
 *   panel de Pusher.
 * - **`pusher-js` se carga solo al entrar en una sala** (~40 KB). Quien solo ve
 *   canales no lo descarga nunca.
 * - **Tolerancia de 1,5 s.** Corregir cada diferencia mínima produce tirones
 *   constantes; solo se salta cuando la desincronización se nota de verdad.
 * - **Supresión de eco.** Al aplicar un cambio recibido, el `<video>` dispara
 *   sus propios eventos; sin una marca temporal se reenviarían y se formaría
 *   un bucle infinito entre los participantes.
 */

const SYNC_TOLERANCE_SECONDS = 1.5;
const ECHO_WINDOW_MS = 700;

export type WatchPartyStatus = "idle" | "connecting" | "connected" | "error";
export type WatchPartyAction = "play" | "pause" | "seek";

interface SyncPayload {
  action: WatchPartyAction;
  currentTime: number;
  /** Momento de emisión, para compensar la latencia de la red. */
  at: number;
}

interface PusherChannelLike {
  bind(event: string, callback: (data: SyncPayload) => void): void;
  trigger(event: string, data: SyncPayload): void;
}
interface PusherLike {
  subscribe(channel: string): PusherChannelLike;
  unsubscribe(channel: string): void;
  disconnect(): void;
  connection: { bind(event: string, callback: () => void): void };
}

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

export function useWatchParty(videoRef: RefObject<HTMLVideoElement | null>, roomId?: string) {
  /**
   * Solo lo escriben las devoluciones de llamada asíncronas de Pusher. El
   * estado visible se deriva más abajo, para no asignar estado dentro del
   * cuerpo del efecto (provoca renders en cascada).
   */
  const [connection, setConnection] = useState<{ room: string; status: "connected" | "error" } | null>(null);
  const channelRef = useRef<PusherChannelLike | null>(null);
  /** Hasta cuándo ignorar los eventos del <video> por venir de un cambio remoto. */
  const suppressUntilRef = useRef(0);

  const room = roomId ? normalizeRoomId(roomId) : "";
  const configured = Boolean(PUSHER_KEY && PUSHER_CLUSTER);

  const status: WatchPartyStatus = !room
    ? "idle"
    : !configured
      ? "error"
      : connection?.room === room
        ? connection.status
        : "connecting";

  useEffect(() => {
    if (!room || !configured) return;
    const key = PUSHER_KEY as string;
    const cluster = PUSHER_CLUSTER as string;

    let cancelled = false;
    let pusher: PusherLike | null = null;

    (async () => {
      try {
        // Carga diferida: solo quien abre una sala paga estos KB.
        const { default: Pusher } = await import("pusher-js");
        if (cancelled) return;

        pusher = new Pusher(key, {
          cluster,
          authEndpoint: "/api/pusher/auth",
        }) as unknown as PusherLike;

        const channel = pusher.subscribe(`private-watch-${room}`);
        channelRef.current = channel;

        pusher.connection.bind("connected", () => !cancelled && setConnection({ room, status: "connected" }));
        pusher.connection.bind("error", () => !cancelled && setConnection({ room, status: "error" }));

        channel.bind("client-sync", (payload: SyncPayload) => {
          const video = videoRef.current;
          if (!video || cancelled) return;

          // Se compensa el tiempo que tardó en llegar el mensaje.
          const latency = Math.max(0, (Date.now() - payload.at) / 1000);
          const target = payload.action === "pause" ? payload.currentTime : payload.currentTime + latency;

          // Marca de eco: lo que hagamos ahora no debe reenviarse.
          suppressUntilRef.current = Date.now() + ECHO_WINDOW_MS;

          if (Math.abs(video.currentTime - target) > SYNC_TOLERANCE_SECONDS) {
            video.currentTime = target;
          }
          if (payload.action === "pause" && !video.paused) video.pause();
          if (payload.action === "play" && video.paused) video.play().catch(() => {});
        });
      } catch (error) {
        console.error("❌ No se pudo conectar al Watch Party:", error);
        if (!cancelled) setConnection({ room, status: "error" });
      }
    })();

    return () => {
      cancelled = true;
      channelRef.current = null;
      try {
        pusher?.unsubscribe(`private-watch-${room}`);
        pusher?.disconnect();
      } catch {
        // Desconectar una conexión ya cerrada no es un problema.
      }
    };
  }, [room, configured, videoRef]);

  const broadcast = useCallback(
    (action: WatchPartyAction) => {
      const video = videoRef.current;
      const channel = channelRef.current;
      if (!video || !channel) return;
      // Si acabamos de aplicar un cambio remoto, no lo devolvemos: es el eco.
      if (Date.now() < suppressUntilRef.current) return;

      try {
        channel.trigger("client-sync", {
          action,
          currentTime: video.currentTime,
          at: Date.now(),
        });
      } catch (error) {
        // Los client events fallan si no están habilitados en el panel de
        // Pusher. No debe romper la reproducción local.
        console.warn("No se pudo enviar el evento de sincronización:", error);
      }
    },
    [videoRef]
  );

  return { status, broadcast, room };
}
