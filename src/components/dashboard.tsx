"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Play,
  Tv,
  Star,
  Heart,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Info,
  SkipBack,
  SkipForward,
} from "lucide-react";
import type { Channel } from "@/lib/types";

// hls.js y mpegts.js dependen de globals del navegador (self, MediaSource) y
// no pueden evaluarse durante el renderizado en servidor.
const StreamPlayer = dynamic(() => import("./stream-player"), {
  ssr: false,
  loading: () => (
    <div className="relative aspect-video w-full animate-pulse rounded-2xl bg-black shadow-2xl ring-1 ring-slate-200" />
  ),
});

interface DashboardProps {
  initialChannels: Channel[];
}

const FAVORITES_STORAGE_KEY = "canalcasa:favorites";

function loadFavoriteUrls(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveFavoriteUrls(urls: Set<string>) {
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(urls)));
  } catch {
    // localStorage no disponible (modo privado, cuota excedida, etc.)
  }
}

const ChannelListItem = memo(function ChannelListItem({
  channel,
  selected,
  onSelect,
  onToggleFavorite,
}: {
  channel: Channel;
  selected: boolean;
  onSelect: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
}) {
  const [logoFailed, setLogoFailed] = useState(false);
  const showLogo = Boolean(channel.logoUrl) && !logoFailed;

  return (
    <div
      className={`virtual-list-item w-full p-3 rounded-xl border flex items-center gap-4 transition text-left focus-within:ring-2 focus-within:ring-emerald-500 ${
        selected
          ? "bg-teal-50 border-teal-300 text-slate-950 shadow-md shadow-teal-200/60"
          : "bg-white/60 border-slate-200 hover:bg-slate-100/80 text-slate-700"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(channel)}
        aria-pressed={selected}
        className="flex flex-1 min-w-0 items-center gap-4 text-left focus:outline-none"
      >
        <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-teal-600 shrink-0 shadow-inner overflow-hidden">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logos vienen de dominios arbitrarios del M3U, no se pueden precargar con next/image
            <img
              src={channel.logoUrl}
              alt=""
              className="h-full w-full object-contain"
              loading="lazy"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            channel.number
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{channel.name}</p>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {channel.category || "Nacional"}
          </p>
        </div>
        {selected && (
          <Play aria-hidden="true" className="h-4 w-4 text-teal-600 shrink-0 fill-current" />
        )}
      </button>
      <button
        type="button"
        onClick={() => onToggleFavorite(channel)}
        aria-label={channel.isFavorite ? `Quitar ${channel.name} de favoritos` : `Agregar ${channel.name} a favoritos`}
        aria-pressed={channel.isFavorite}
        className={`p-2 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          channel.isFavorite ? "text-amber-400" : "text-slate-400 hover:text-amber-400"
        }`}
      >
        <Star aria-hidden="true" className={`h-4 w-4 ${channel.isFavorite ? "fill-current" : ""}`} />
      </button>
    </div>
  );
});

export function Dashboard({ initialChannels }: DashboardProps) {
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(
    initialChannels[0] ?? null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Los favoritos viven solo en el navegador (sin base de datos). Se aplican
  // después del montaje a propósito: localStorage no existe en el render de
  // servidor, así que hacerlo antes rompería la hidratación de Next.js.
  useEffect(() => {
    const favoriteUrls = loadFavoriteUrls();
    if (favoriteUrls.size === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChannels((prev) => prev.map((c) => (favoriteUrls.has(c.streamUrl) ? { ...c, isFavorite: true } : c)));
    setSelectedChannel((prev) => (prev && favoriteUrls.has(prev.streamUrl) ? { ...prev, isFavorite: true } : prev));
  }, []);

  const categories = useMemo(
    () => [
      "Todas",
      ...Array.from(new Set(channels.map((c) => c.category).filter(Boolean))),
    ],
    [channels]
  );

  const filteredChannels = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    return channels.filter((channel) => {
      const matchesSearch =
        !query ||
        channel.name.toLowerCase().includes(query) ||
        channel.number.includes(query);
      const matchesCategory =
        selectedCategory === "Todas" || channel.category === selectedCategory;
      const matchesFavorites = !showFavoritesOnly || channel.isFavorite;
      return matchesSearch && matchesCategory && matchesFavorites;
    });
  }, [channels, deferredSearchQuery, selectedCategory, showFavoritesOnly]);

  const handleSelectChannel = useCallback((channel: Channel) => {
    setSelectedChannel(channel);
  }, []);

  const handleToggleFavorite = useCallback((channel: Channel) => {
    setChannels((prev) => {
      const next = prev.map((c) => (c.id === channel.id ? { ...c, isFavorite: !c.isFavorite } : c));
      saveFavoriteUrls(new Set(next.filter((c) => c.isFavorite).map((c) => c.streamUrl)));
      return next;
    });
    setSelectedChannel((prev) => (prev && prev.id === channel.id ? { ...prev, isFavorite: !prev.isFavorite } : prev));
  }, []);

  const isSearchStale = searchQuery !== deferredSearchQuery;

  // Navegación por teclado / control remoto (TV)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === searchRef.current && e.key !== "Escape") return;

      // Atajos globales
      if (e.key === "m" || e.key === "M") {
        const muteBtn = document.querySelector('[aria-label*="Silenciar"], [aria-label*="Activar sonido (M)"]') as HTMLButtonElement | null;
        muteBtn?.click();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        const fsBtn = document.querySelector('[aria-label="Pantalla completa (F)"]') as HTMLButtonElement | null;
        fsBtn?.click();
        return;
      }
      if (e.key === " " || e.key === "k" || e.key === "K" || e.key === "MediaPlayPause") {
        e.preventDefault();
        const playBtn = document.querySelector('[aria-label*="Pausar"], [aria-label*="Reproducir"]') as HTMLButtonElement | null;
        playBtn?.click();
        return;
      }
      if (e.key === "Escape") {
        setShowShortcuts(false);
        return;
      }
      if (e.key === "?") {
        setShowShortcuts((s) => !s);
        return;
      }

      // Números para cambiar de canal
      if (/^[0-9]$/.test(e.key)) {
        const num = e.key;
        const match = channels.find((c) => c.number === num);
        if (match) {
          setSelectedChannel(match);
          return;
        }
      }

      // Flechas ↑ ↓ / PageUp PageDown / MediaTrackNext Prev para canales
      const isUp = e.key === "ArrowUp" || e.key === "PageUp" || e.key === "MediaTrackPrevious";
      const isDown = e.key === "ArrowDown" || e.key === "PageDown" || e.key === "MediaTrackNext";
      if (isUp || isDown) {
        e.preventDefault();
        setSelectedChannel((current) => {
          if (!current) return filteredChannels[0] ?? null;
          const idx = filteredChannels.findIndex((c) => c.id === current.id);
          const step = e.key === "PageDown" || e.key === "MediaTrackNext" ? 10 : 1;
          const next = isDown
            ? filteredChannels[Math.min(idx + step, filteredChannels.length - 1)]
            : filteredChannels[Math.max(idx - step, 0)];
          return next ?? current;
        });
        return;
      }

      // Flechas ← → para cambiar categorías
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedCategory((current) => {
          const idx = categories.indexOf(current);
          const delta = e.key === "ArrowRight" ? 1 : -1;
          const nextIdx = (idx + delta + categories.length) % categories.length;
          return categories[nextIdx];
        });
        return;
      }

      // Enter alterna favorito del canal seleccionado
      if (e.key === "Enter") {
        if (document.activeElement === searchRef.current) return;
        if (selectedChannel) {
          handleToggleFavorite(selectedChannel);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [channels, filteredChannels, categories, handleToggleFavorite, selectedChannel]);

  // Scroll al canal seleccionado
  useEffect(() => {
    if (!selectedChannel || !listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-channel-id="${selectedChannel.id}"]`);
    selectedEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedChannel]);

  const goToPrevChannel = useCallback(() => {
    setSelectedChannel((current) => {
      if (!current) return filteredChannels[0] ?? null;
      const idx = filteredChannels.findIndex((c) => c.id === current.id);
      return filteredChannels[Math.max(idx - 1, 0)] ?? current;
    });
  }, [filteredChannels]);

  const goToNextChannel = useCallback(() => {
    setSelectedChannel((current) => {
      if (!current) return filteredChannels[0] ?? null;
      const idx = filteredChannels.findIndex((c) => c.id === current.id);
      return filteredChannels[Math.min(idx + 1, filteredChannels.length - 1)] ?? current;
    });
  }, [filteredChannels]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 md:p-8">
      {/* Resplandor decorativo de fondo */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-teal-200/60 to-transparent" />

      <header className="relative mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-100 ring-1 ring-teal-200">
                <Tv aria-hidden="true" className="h-6 w-6 text-teal-600" />
              </span>
              CanalCasa
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Plataforma de streaming HD con reproducción nativa
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowShortcuts((s) => !s)}
            aria-label="Ver atajos de teclado"
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-950 hover:border-slate-300 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Info aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[280px]">
            <Search aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Buscar por nombre o número..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar canales"
              className="w-full rounded-xl bg-white border border-slate-200 py-2.5 pl-10 pr-4 text-sm text-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
            {isSearchStale && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-emerald-500/40 border-t-emerald-400 animate-spin" aria-hidden="true" />
            )}
          </div>
        </div>
      </header>

      {/* Panel de atajos */}
      {showShortcuts && (
        <div className="relative mb-6 rounded-2xl border border-teal-200 bg-teal-50 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-teal-600 uppercase tracking-widest">Atajos de control remoto</h2>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              aria-label="Cerrar atajos"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-950 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2 text-slate-700">
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">↑ ↓</kbd>
              Cambiar canal
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">PgUp PgDn</kbd>
              Salto 10 canales
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">← →</kbd>
              Cambiar categoría
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">0-9</kbd>
              Ir al canal
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">Espacio</kbd>
              Play / Pausa
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">⏮ ⏭</kbd>
              Canal ant/sig
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">M</kbd>
              Silenciar
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">F</kbd>
              Pantalla completa
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">Enter</kbd>
              Marcar favorito
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">?</kbd>
              Mostrar atajos
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">Esc</kbd>
              Cerrar
            </div>
          </div>
        </div>
      )}

      <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {selectedChannel ? (
            <>
              <StreamPlayer channel={selectedChannel} />

              {/* Botones de canal anterior/siguiente */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goToPrevChannel}
                  aria-label="Canal anterior"
                  className="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition flex items-center justify-center gap-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <SkipBack aria-hidden="true" className="h-4 w-4" />
                  Anterior
                </button>
                <span className="text-xs text-slate-500 font-mono">
                  {selectedChannel.number} / {filteredChannels.length}
                </span>
                <button
                  type="button"
                  onClick={goToNextChannel}
                  aria-label="Canal siguiente"
                  className="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition flex items-center justify-center gap-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  Siguiente
                  <SkipForward aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>

              <div className="bg-white/50 border border-slate-200 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-teal-600 uppercase tracking-widest">
                    {selectedChannel.category || "General"}
                  </span>
                  {selectedChannel.isFavorite && (
                    <Star aria-hidden="true" className="h-4 w-4 text-amber-400 fill-current" />
                  )}
                </div>
                <h2 className="text-2xl font-bold text-slate-950 mb-2">
                  {selectedChannel.number}. {selectedChannel.name}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {selectedChannel.description || "Transmisión en vivo."}
                </p>
              </div>
            </>
          ) : (
            <div className="aspect-video bg-white/60 rounded-2xl flex flex-col items-center justify-center border border-slate-200 text-center p-6">
              <Tv aria-hidden="true" className="h-12 w-12 text-slate-400 mb-3" />
              <p className="text-slate-500 font-medium">Ningún canal seleccionado</p>
              <p className="text-xs text-slate-400 mt-1">
                Elige un canal de la lista para iniciar la reproducción
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none" role="tablist" aria-label="Categorías">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  selectedCategory === category
                    ? "bg-teal-600 text-white shadow-lg shadow-teal-600/20"
                    : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {category}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowFavoritesOnly((s) => !s)}
              aria-pressed={showFavoritesOnly}
              className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition focus:outline-none focus:ring-2 focus:ring-amber-500 flex items-center gap-1.5 ${
                showFavoritesOnly
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <Heart aria-hidden="true" className={`h-3.5 w-3.5 ${showFavoritesOnly ? "fill-current" : ""}`} />
              Favoritos
            </button>
          </div>

          <div
            ref={listRef}
            className="max-h-[620px] overflow-y-auto space-y-2 pr-1 custom-scrollbar"
            role="list"
            aria-label="Lista de canales"
          >
            {filteredChannels.length > 0 ? (
              filteredChannels.map((channel) => (
                <div key={channel.id} data-channel-id={channel.id}>
                  <ChannelListItem
                    channel={channel}
                    selected={selectedChannel?.id === channel.id}
                    onSelect={handleSelectChannel}
                    onToggleFavorite={handleToggleFavorite}
                  />
                </div>
              ))
            ) : (
              <div role="status" className="p-8 text-center text-slate-500 text-sm bg-white/40 rounded-xl border border-slate-200">
                No se encontraron canales que coincidan con la búsqueda.
              </div>
            )}
          </div>

          {/* Indicador de navegación TV */}
          <div className="hidden lg:flex items-center justify-center gap-4 text-[11px] text-slate-400 pt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <ArrowUp aria-hidden="true" className="h-3 w-3" />
              <ArrowDown aria-hidden="true" className="h-3 w-3" />
              Canales
            </span>
            <span className="flex items-center gap-1">
              <ArrowLeft aria-hidden="true" className="h-3 w-3" />
              <ArrowRight aria-hidden="true" className="h-3 w-3" />
              Categorías
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono">0-9</kbd>
              Canal directo
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono">Enter</kbd>
              Favorito
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
