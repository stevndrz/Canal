"use client";

import { useCallback, useMemo } from "react";
import { useAppStore, useStoreHydrated } from "@/store/use-app-store";
import type { Channel } from "@/lib/types";

/**
 * Favoritos del usuario, identificados por la URL del stream para que
 * sobrevivan a cambios de orden o de numeración de la lista M3U.
 *
 * La firma se mantiene igual que antes (`{ channels, toggleFavorite }`), pero
 * por dentro ahora lee del store de Zustand, que persiste en localStorage. Ya
 * no hace falta escribir estado dentro de un efecto tras el montaje.
 */
export function useFavorites(initialChannels: Channel[]) {
  const favoriteUrls = useAppStore((state) => state.favoriteUrls);
  const toggleInStore = useAppStore((state) => state.toggleFavorite);
  // Hasta que localStorage esté leído se usa la lista tal cual llegó del
  // servidor, para que el HTML del servidor y el del navegador coincidan.
  const hydrated = useStoreHydrated();

  const favoriteSet = useMemo(() => new Set(favoriteUrls), [favoriteUrls]);

  const channels = useMemo(() => {
    if (!hydrated || favoriteSet.size === 0) return initialChannels;
    return initialChannels.map((channel) =>
      favoriteSet.has(channel.streamUrl) ? { ...channel, isFavorite: true } : channel
    );
  }, [initialChannels, favoriteSet, hydrated]);

  const toggleFavorite = useCallback(
    (channel: Channel) => toggleInStore(channel.streamUrl),
    [toggleInStore]
  );

  return { channels, toggleFavorite };
}
