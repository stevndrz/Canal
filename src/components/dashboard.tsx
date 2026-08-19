"use client";

import dynamic from "next/dynamic";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Heart,
  Info,
  Radio,
  Search,
  SkipBack,
  SkipForward,
  Star,
  Tv,
} from "lucide-react";
import { ChannelTile } from "./channel-tile";
import { QuickAccess } from "./quick-access";
import { ShortcutsPanel } from "./shortcuts-panel";
import { FEATURED_CHANNEL_PATTERNS, getCategoryStyle } from "@/lib/categories";
import { normalizeText } from "@/lib/text";
import { useFavorites } from "@/hooks/use-favorites";
import type { Channel } from "@/lib/types";

/** Tarjetas que se pintan por tanda al recorrer la guía. */
const CHANNELS_PER_PAGE = 120;

// hls.js y mpegts.js dependen de globals del navegador (self, MediaSource) y
// no pueden evaluarse durante el render en servidor.
const StreamPlayer = dynamic(() => import("./stream-player"), {
  ssr: false,
  loading: () => <div className="aspect-video w-full animate-pulse bg-black" />,
});

export function Dashboard({ initialChannels }: { initialChannels: Channel[] }) {
  const { channels, toggleFavorite } = useFavorites(initialChannels);

  const [selectedId, setSelectedId] = useState<number | undefined>(initialChannels[0]?.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const deferredQuery = useDeferredValue(searchQuery);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // Derivar el canal del id evita mantener dos copias del mismo objeto en
  // estado (que se desincronizaban al marcar favoritos).
  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.id === selectedId) ?? null,
    [channels, selectedId]
  );

  const featuredChannels = useMemo(() => {
    const result: Channel[] = [];
    for (const { pattern } of FEATURED_CHANNEL_PATTERNS) {
      const match = channels.find(
        (channel) => pattern.test(normalizeText(channel.name)) && !result.includes(channel)
      );
      if (match) result.push(match);
    }
    return result;
  }, [channels]);

  const categories = useMemo(
    () => ["Todas", ...Array.from(new Set(channels.map((channel) => channel.category).filter(Boolean)))],
    [channels]
  );

  const filteredChannels = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    return channels.filter((channel) => {
      const matchesSearch =
        !query || channel.name.toLowerCase().includes(query) || channel.number.includes(query);
      const matchesCategory = selectedCategory === "Todas" || channel.category === selectedCategory;
      const matchesFavorites = !showFavoritesOnly || channel.isFavorite;
      return matchesSearch && matchesCategory && matchesFavorites;
    });
  }, [channels, deferredQuery, selectedCategory, showFavoritesOnly]);

  // Con listas de más de 10.000 canales, pintar todas las tarjetas de golpe
  // genera decenas de MB de HTML y bloquea teléfonos y TVs viejas. Se muestran
  // por tandas y se amplía al llegar al final de la guía.
  const [visibleCount, setVisibleCount] = useState(CHANNELS_PER_PAGE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Al cambiar de filtro se vuelve a empezar desde la primera tanda.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisibleCount(CHANNELS_PER_PAGE);
  }, [deferredQuery, selectedCategory, showFavoritesOnly]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => count + CHANNELS_PER_PAGE);
        }
      },
      { rootMargin: "600px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredChannels.length]);

  const visibleChannels = useMemo(
    () => filteredChannels.slice(0, visibleCount),
    [filteredChannels, visibleCount]
  );

  const selectChannel = useCallback((channel: Channel) => setSelectedId(channel.id), []);

  const stepChannel = useCallback(
    (delta: number) => {
      setSelectedId((currentId) => {
        if (filteredChannels.length === 0) return currentId;
        const index = filteredChannels.findIndex((channel) => channel.id === currentId);
        if (index === -1) return filteredChannels[0].id;
        const nextIndex = Math.min(Math.max(index + delta, 0), filteredChannels.length - 1);
        // Al navegar con el control remoto más allá de la tanda pintada, se
        // amplía para que la tarjeta exista y se pueda hacer scroll hasta ella.
        setVisibleCount((count) =>
          nextIndex < count ? count : Math.ceil((nextIndex + 1) / CHANNELS_PER_PAGE) * CHANNELS_PER_PAGE
        );
        return filteredChannels[nextIndex].id;
      });
    },
    [filteredChannels]
  );

  // Navegación por teclado / control remoto.
  useEffect(() => {
    const clickByLabel = (selector: string) => {
      (document.querySelector(selector) as HTMLButtonElement | null)?.click();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Mientras se escribe en la búsqueda solo interesa Escape.
      if (document.activeElement === searchRef.current) {
        if (event.key === "Escape") searchRef.current?.blur();
        return;
      }

      switch (event.key) {
        case "m":
        case "M":
          clickByLabel('[aria-label*="Silenciar"], [aria-label*="Activar sonido"]');
          return;
        case "f":
        case "F":
          clickByLabel('[aria-label*="antalla completa"]');
          return;
        case " ":
        case "k":
        case "K":
        case "MediaPlayPause":
          event.preventDefault();
          clickByLabel('[aria-label*="Pausar"], [aria-label*="Reproducir"]');
          return;
        case "Escape":
          setShowShortcuts(false);
          return;
        case "?":
          setShowShortcuts((visible) => !visible);
          return;
        case "Enter":
          if (selectedChannel) toggleFavorite(selectedChannel);
          return;
      }

      if (/^[0-9]$/.test(event.key)) {
        const match = channels.find((channel) => channel.number === event.key);
        if (match) setSelectedId(match.id);
        return;
      }

      const stepFor: Record<string, number> = {
        ArrowUp: -1,
        MediaTrackPrevious: -1,
        PageUp: -10,
        ArrowDown: 1,
        MediaTrackNext: 1,
        PageDown: 10,
      };
      const step = stepFor[event.key];
      if (step !== undefined) {
        event.preventDefault();
        stepChannel(step);
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedCategory((current) => {
          const index = categories.indexOf(current);
          const delta = event.key === "ArrowRight" ? 1 : -1;
          return categories[(index + delta + categories.length) % categories.length];
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [channels, categories, selectedChannel, stepChannel, toggleFavorite]);

  // Mantiene visible el canal seleccionado al navegar con el control remoto.
  useEffect(() => {
    if (selectedId === undefined) return;
    gridRef.current
      ?.querySelector(`[data-channel-id="${selectedId}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  const isSearchStale = searchQuery !== deferredQuery;
  const selectedStyle = getCategoryStyle(selectedChannel?.category ?? "");

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(20,184,166,0.16),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -right-32 top-24 -z-10 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl"
      />

      <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-6 md:px-8 md:py-6">
        <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-600/25">
              <Tv aria-hidden="true" className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">CanalCasa</h1>
            <button
              type="button"
              onClick={() => setShowShortcuts((visible) => !visible)}
              aria-label="Ver atajos de control remoto"
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-slate-300 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Buscar canales"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-950 shadow-sm placeholder-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {isSearchStale && (
              <span
                aria-hidden="true"
                className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-emerald-500/40 border-t-emerald-400"
              />
            )}
          </div>
        </header>

        {showShortcuts && <ShortcutsPanel onClose={() => setShowShortcuts(false)} />}

        <QuickAccess channels={featuredChannels} selectedId={selectedId} onSelect={selectChannel} />

        <section className="mb-6">
          {selectedChannel ? (
            <>
              <div className="overflow-hidden rounded-2xl shadow-2xl shadow-slate-900/10 ring-1 ring-slate-200 sm:rounded-3xl">
                <StreamPlayer channel={selectedChannel} />
              </div>

              <div className="relative mt-4 flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${selectedStyle.chip}`} />
                <div className="min-w-0 pl-2">
                  <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${selectedStyle.text}`}>
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
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-600">
                        <Radio aria-hidden="true" className="h-3 w-3" />
                        Al aire
                      </span>
                      <span className="truncate font-medium text-slate-800">{selectedChannel.currentProgram}</span>
                    </p>
                  )}
                  {selectedChannel.nextProgram && (
                    <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                      <span className="shrink-0 font-semibold uppercase tracking-wide text-slate-400">Sigue</span>
                      <span className="truncate">{selectedChannel.nextProgram}</span>
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => stepChannel(-1)}
                    aria-label="Canal anterior"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <SkipBack aria-hidden="true" className="h-4 w-4" />
                    Anterior
                  </button>
                  <span className="font-mono text-xs text-slate-400">
                    {selectedChannel.number}/{channels.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => stepChannel(1)}
                    aria-label="Canal siguiente"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <p className="font-medium text-slate-500">
                {channels.length === 0 ? "No se pudo cargar la lista de canales" : "Ningún canal seleccionado"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {channels.length === 0
                  ? "Revisa la lista M3U configurada y vuelve a intentar."
                  : "Elige un canal de la guía para empezar"}
              </p>
            </div>
          )}
        </section>

        <section>
          <div className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-none" role="tablist" aria-label="Categorías">
            {categories.map((category) => {
              const active = selectedCategory === category;
              const style = category === "Todas" ? null : getCategoryStyle(category);
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(category)}
                  className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    active
                      ? `${style?.chip ?? "bg-gradient-to-r from-teal-600 to-emerald-600"} text-white shadow-md`
                      : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {category}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowFavoritesOnly((only) => !only)}
              aria-pressed={showFavoritesOnly}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                showFavoritesOnly
                  ? "bg-gradient-to-r from-amber-400 to-amber-500 text-white shadow-md"
                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Heart aria-hidden="true" className={`h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
              Favoritos
            </button>
          </div>

          {filteredChannels.length > 0 ? (
            <>
              <div
                ref={gridRef}
                className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(104px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(136px,1fr))]"
                role="list"
                aria-label="Guía de canales"
              >
                {visibleChannels.map((channel) => (
                  <ChannelTile
                    key={channel.id}
                    channel={channel}
                    selected={channel.id === selectedId}
                    onSelect={selectChannel}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
              {visibleChannels.length < filteredChannels.length && (
                <div ref={loadMoreRef} className="py-6 text-center text-xs text-slate-400">
                  Mostrando {visibleChannels.length} de {filteredChannels.length} canales…
                </div>
              )}
            </>
          ) : (
            <div
              role="status"
              className="rounded-xl border border-slate-200 bg-white/60 p-8 text-center text-sm text-slate-500"
            >
              {showFavoritesOnly
                ? "Todavía no has marcado canales como favoritos."
                : "No se encontraron canales que coincidan con la búsqueda."}
            </div>
          )}

          <div className="mt-5 hidden flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400 sm:flex">
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
