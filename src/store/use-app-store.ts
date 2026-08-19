"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Estado global de la app, persistido en localStorage.
 *
 * Zustand se elige por peso (~1 KB) y porque escribe fuera del ciclo de render
 * de React: marcar un favorito con 15.000 canales en memoria no bloquea el hilo
 * principal, que es justo lo que se nota en el procesador de una Smart TV.
 */

/** Nitidez al escalar el video en pantallas grandes. */
export type SharpnessMode = "smooth" | "sharp";

interface AppState {
  /** URLs de stream marcadas como favoritas (sobreviven a cambios de la lista). */
  favoriteUrls: string[];
  toggleFavorite: (streamUrl: string) => void;
  isFavorite: (streamUrl: string) => boolean;

  /** Último canal visto, para reabrir donde se quedó. */
  lastChannelUrl: string | null;
  setLastChannel: (streamUrl: string) => void;

  /** Preferencias de imagen. */
  sharpness: SharpnessMode;
  setSharpness: (mode: SharpnessMode) => void;

  /**
   * Modo TV: desactiva desenfoques y sombras caras, que son lo primero que
   * hace tirones en la GPU de un televisor.
   */
  tvMode: boolean;
  setTvMode: (enabled: boolean) => void;

  /** Cómo se listan los canales: cuadritos con logo o lista compacta. */
  channelView: "grid" | "list";
  setChannelView: (view: "grid" | "list") => void;

  /**
   * Último servidor de video que se usó.
   *
   * Se recuerda porque estos proveedores fallan de forma desigual: si uno le
   * funcionó, no tiene sentido obligar a redescubrirlo en cada película.
   */
  preferredProvider: string | null;
  setPreferredProvider: (id: string) => void;

  /** Sala de Watch Party activa (vacía = no hay sala). */
  watchPartyRoom: string;
  setWatchPartyRoom: (room: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      favoriteUrls: [],
      toggleFavorite: (streamUrl) =>
        set((state) => ({
          favoriteUrls: state.favoriteUrls.includes(streamUrl)
            ? state.favoriteUrls.filter((url) => url !== streamUrl)
            : [...state.favoriteUrls, streamUrl],
        })),
      isFavorite: (streamUrl) => get().favoriteUrls.includes(streamUrl),

      lastChannelUrl: null,
      setLastChannel: (streamUrl) => set({ lastChannelUrl: streamUrl }),

      sharpness: "smooth",
      setSharpness: (sharpness) => set({ sharpness }),

      tvMode: false,
      setTvMode: (tvMode) => set({ tvMode }),

      channelView: "grid",
      setChannelView: (channelView) => set({ channelView }),

      preferredProvider: null,
      setPreferredProvider: (preferredProvider) => set({ preferredProvider }),

      watchPartyRoom: "",
      setWatchPartyRoom: (watchPartyRoom) => set({ watchPartyRoom }),
    }),
    {
      name: "canalcasa",
      // La sala de Watch Party es de la sesión, no debe revivir al reabrir.
      partialize: ({ favoriteUrls, lastChannelUrl, sharpness, tvMode, preferredProvider, channelView }) => ({
        favoriteUrls,
        lastChannelUrl,
        sharpness,
        tvMode,
        preferredProvider,
        channelView,
      }),
    }
  )
);

/**
 * Indica si el estado persistido ya se leyó de localStorage.
 *
 * Hace falta porque el servidor renderiza sin favoritos y el navegador los
 * añade después: pintarlos antes de la hidratación provocaría un desajuste.
 * Se usa `useSyncExternalStore` para que el componente se vuelva a pintar en
 * cuanto termina la hidratación, sin efectos ni estado intermedio.
 */
export function useStoreHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => useAppStore.persist.onFinishHydration(onStoreChange),
    () => useAppStore.persist.hasHydrated(),
    () => false // en el servidor nunca hay nada hidratado
  );
}
