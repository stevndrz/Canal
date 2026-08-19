"use client";

import { useCallback, useEffect, useState } from "react";
import type { Channel } from "@/lib/types";

/**
 * Favoritos guardados en el navegador (sin base de datos), identificados por
 * la URL del stream para que sobrevivan a cambios de orden o de numeración de
 * la lista M3U.
 */
const STORAGE_KEY = "canalcasa:favorites";

function readStoredUrls(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function writeStoredUrls(urls: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(urls)));
  } catch {
    // localStorage no disponible (modo privado, cuota llena): los favoritos
    // siguen funcionando en esta sesión.
  }
}

export function useFavorites(initialChannels: Channel[]) {
  const [channels, setChannels] = useState<Channel[]>(initialChannels);

  // Se aplica después del montaje a propósito: localStorage no existe durante
  // el render en servidor, así que hacerlo antes rompería la hidratación.
  useEffect(() => {
    const storedUrls = readStoredUrls();
    if (storedUrls.size === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChannels((previous) =>
      previous.map((channel) => (storedUrls.has(channel.streamUrl) ? { ...channel, isFavorite: true } : channel))
    );
  }, []);

  const toggleFavorite = useCallback((target: Channel) => {
    setChannels((previous) => {
      const next = previous.map((channel) =>
        channel.id === target.id ? { ...channel, isFavorite: !channel.isFavorite } : channel
      );
      writeStoredUrls(new Set(next.filter((channel) => channel.isFavorite).map((channel) => channel.streamUrl)));
      return next;
    });
  }, []);

  return { channels, toggleFavorite };
}
