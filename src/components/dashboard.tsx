"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
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
  Radio,
} from "lucide-react";
import type { Channel } from "@/lib/types";

// hls.js y mpegts.js dependen de globals del navegador (self, MediaSource) y
// no pueden evaluarse durante el renderizado en servidor.
const StreamPlayer = dynamic(() => import("./stream-player"), {
  ssr: false,
  loading: () => (
    <div className="relative aspect-video w-full animate-pulse rounded-2xl bg-black shadow-xl" />
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

const ChannelTile = memo(function ChannelTile({
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
      data-channel-id={channel.id}
      className={`channel-tile group relative flex flex-col items-center rounded-2xl border p-3 text-center transition focus-within:ring-4 focus-within:ring-emerald-400 ${
        selected
          ? "border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-900/10"
          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/50"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(channel)}
        aria-pressed={selected}
        className="flex w-full flex-col items-center gap-2 focus:outline-none"
      >
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-lg font-black text-teal-700 sm:h-20 sm:w-20">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logos vienen de dominios arbitrarios del M3U, no se pueden precargar con next/image
            <img
              src={channel.logoUrl}
              alt=""
              className="h-full w-full object-contain p-1.5"
              loading="lazy"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            channel.logoText
          )}
        </span>
        <span className="w-full truncate text-sm font-semibold text-slate-900 sm:text-[15px]">
          {channel.name}
        </span>
        <span className="text-[11px] font-medium text-slate-400">{channel.number}</span>
      </button>

      <button
        type="button"
        onClick={() => onToggleFavorite(channel)}
        aria-label={channel.isFavorite ? `Quitar ${channel.name} de favoritos` : `Agregar ${channel.name} a favoritos`}
        aria-pressed={channel.isFavorite}
        className={`absolute right-1.5 top-1.5 rounded-full p-1.5 transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          channel.isFavorite ? "text-amber-400" : "text-slate-300 hover:text-amber-400"
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
  const gridRef = useRef<HTMLDivElement | null>(null);
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

  // Mantiene el canal seleccionado visible al navegar con el control remoto
  useEffect(() => {
    if (!selectedChannel || !gridRef.current) return;
    const selectedEl = gridRef.current.querySelector(`[data-channel-id="${selectedChannel.id}"]`);
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 md:px-8 md:py-6">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-600 text-white">
              <Tv aria-hidden="true" className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              CanalCasa
            </h1>
            <button
              type="button"
              onClick={() => setShowShortcuts((s) => !s)}
              aria-label="Ver atajos de control remoto"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-950 hover:border-slate-300 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <Info aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <div className="relative sm:w-72">
            <Search aria-hidden="true" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Buscar canal o número..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar canales"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-950 placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {isSearchStale && (
              <span aria-hidden="true" className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-emerald-500/40 border-t-emerald-400" />
            )}
          </div>
        </header>

        {showShortcuts && (
          <div className="relative mb-5 rounded-2xl border border-teal-200 bg-teal-50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-widest text-teal-600">Atajos de control remoto</h2>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                aria-label="Cerrar atajos"
                className="rounded-lg p-1.5 text-slate-500 transition hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              {[
                ["↑ ↓", "Cambiar canal"],
                ["PgUp PgDn", "Salto 10 canales"],
                ["← →", "Cambiar categoría"],
                ["0-9", "Ir al canal"],
                ["Espacio", "Play / Pausa"],
                ["M", "Silenciar"],
                ["F", "Pantalla completa"],
                ["Enter", "Marcar favorito"],
                ["?", "Mostrar atajos"],
                ["Esc", "Cerrar"],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center gap-2 text-slate-700">
                  <kbd className="rounded border border-slate-300 bg-slate-100 px-2 py-1 font-mono text-xs">{key}</kbd>
                  {label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reproductor + información del canal actual */}
        <section className="mb-6">
          {selectedChannel ? (
            <>
              <StreamPlayer channel={selectedChannel} />

              <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-teal-600">
                    <span>{selectedChannel.category || "General"}</span>
                    {selectedChannel.isFavorite && (
                      <Star aria-hidden="true" className="h-3.5 w-3.5 fill-current text-amber-400" />
                    )}
                  </div>
                  <h2 className="mt-1 truncate text-xl font-bold text-slate-950 sm:text-2xl">
                    {selectedChannel.number}. {selectedChannel.name}
                  </h2>
                  {selectedChannel.currentProgram && (
                    <p className="mt-2 flex items-center gap-2 text-sm">
                      <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-600">
                        <Radio aria-hidden="true" className="h-3 w-3" />
                        Al aire
                      </span>
                      <span className="truncate font-medium text-slate-800">{selectedChannel.currentProgram}</span>
                    </p>
                  )}
                  {selectedChannel.nextProgram && (
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold uppercase tracking-wide text-slate-400">Sigue</span>
                      <span className="truncate">{selectedChannel.nextProgram}</span>
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={goToPrevChannel}
                    aria-label="Canal anterior"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <SkipBack aria-hidden="true" className="h-4 w-4" />
                    Anterior
                  </button>
                  <span className="font-mono text-xs text-slate-400">
                    {selectedChannel.number}/{filteredChannels.length}
                  </span>
                  <button
                    type="button"
                    onClick={goToNextChannel}
                    aria-label="Canal siguiente"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    Siguiente
                    <SkipForward aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <Tv aria-hidden="true" className="mb-3 h-12 w-12 text-slate-400" />
              <p className="font-medium text-slate-500">Ningún canal seleccionado</p>
              <p className="mt-1 text-xs text-slate-400">Elige un canal de la guía para empezar</p>
            </div>
          )}
        </section>

        {/* Guía de canales */}
        <section>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none" role="tablist" aria-label="Categorías">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
                className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                  selectedCategory === category
                    ? "bg-teal-600 text-white shadow-lg shadow-teal-600/20"
                    : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                }`}
              >
                {category}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowFavoritesOnly((s) => !s)}
              aria-pressed={showFavoritesOnly}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                showFavoritesOnly
                  ? "border border-amber-400/60 bg-amber-50 text-amber-600"
                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Heart aria-hidden="true" className={`h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
              Favoritos
            </button>
          </div>

          {filteredChannels.length > 0 ? (
            <div
              ref={gridRef}
              className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(112px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(136px,1fr))]"
              role="list"
              aria-label="Guía de canales"
            >
              {filteredChannels.map((channel) => (
                <ChannelTile
                  key={channel.id}
                  channel={channel}
                  selected={selectedChannel?.id === channel.id}
                  onSelect={handleSelectChannel}
                  onToggleFavorite={handleToggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div role="status" className="rounded-xl border border-slate-200 bg-white/60 p-8 text-center text-sm text-slate-500">
              No se encontraron canales que coincidan con la búsqueda.
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
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
              <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono">0-9</kbd>
              Canal directo
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-mono">Enter</kbd>
              Favorito
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
