"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Tv,
  Radio,
  Sparkles,
  CalendarClock,
  Star,
  Heart,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  LogOut,
  Info,
} from "lucide-react";

interface Channel {
  id: number;
  name: string;
  number: string;
  category: string;
  description: string;
  logoText: string;
  logoUrl: string;
  streamUrl: string;
  color: string;
  websiteUrl: string;
  currentProgram: string;
  nextProgram: string;
  progress: number;
  isFavorite: boolean;
  isLive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DashboardProps {
  initialChannels: Channel[];
}

const StreamPlayer = memo(function StreamPlayer({ channel }: { channel: Channel }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [streamError, setStreamError] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streamUrl = channel.streamUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setStreamError(false);
    video.src = streamUrl;
    video.load();

    video.play().then(() => {
      if (!cancelled) setIsPlaying(true);
    }).catch(() => {
      if (cancelled) return;
      // Si el navegador bloquea el autoplay con audio, silenciamos e intentamos de nuevo
      video.muted = true;
      setIsMuted(true);
      video.play().catch(() => setIsPlaying(false));
    });

    const handleError = () => {
      if (!cancelled) setStreamError(true);
    };

    video.addEventListener("error", handleError);
    return () => {
      cancelled = true;
      video.removeEventListener("error", handleError);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [channel.id, streamUrl]);

  // Auto-ocultar controles en TV después de 4s
  useEffect(() => {
    const show = () => {
      setShowControls(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setShowControls(false), 4000);
    };
    show();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [channel.id]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
    setShowControls(true);
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
    setShowControls(true);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
    setShowControls(true);
  }, []);

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10 group"
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        autoPlay
        muted={isMuted}
      />

      {/* Header flotante - siempre visible en TV */}
      <div className={`absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent p-4 flex items-center justify-between transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="flex items-center gap-3">
          <span className="flex h-3 w-3 relative" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-red-500">
            EN VIVO
          </span>
          <span className="text-sm font-semibold text-white/90">
            {channel.number} • {channel.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400 backdrop-blur-md border border-emerald-500/30">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          <span>Reproducción Nativa</span>
        </div>
      </div>

      {/* Controles del reproductor - siempre visibles en TV */}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex items-center justify-between transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pausar (espacio)" : "Reproducir (espacio)"}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {isPlaying ? <Pause aria-hidden="true" className="h-5 w-5" /> : <Play aria-hidden="true" className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Activar sonido (M)" : "Silenciar (M)"}
            aria-pressed={isMuted}
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {isMuted ? <VolumeX aria-hidden="true" className="h-5 w-5" /> : <Volume2 aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>

        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Pantalla completa (F)"
          className="p-3 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <Maximize aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      {streamError && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 p-6 text-center z-10">
          <Radio aria-hidden="true" className="h-12 w-12 text-red-500 mb-3 animate-pulse" />
          <p className="text-lg font-bold text-white">Error de Reproducción</p>
          <p className="text-sm text-zinc-400 mt-1 max-w-sm mb-4">
            El navegador no pudo decodificar este formato directamente.
          </p>
        </div>
      )}
    </div>
  );
});

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
  return (
    <div
      className={`virtual-list-item w-full p-3 rounded-xl border flex items-center gap-4 transition text-left focus-within:ring-2 focus-within:ring-emerald-500 ${
        selected
          ? "bg-emerald-500/10 border-emerald-500/60 text-white shadow-md shadow-emerald-500/5"
          : "bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-800/80 text-zinc-300"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(channel)}
        aria-pressed={selected}
        className="flex flex-1 min-w-0 items-center gap-4 text-left focus:outline-none"
      >
        <div className="h-10 w-10 rounded-lg bg-zinc-800 border border-zinc-700/50 flex items-center justify-center font-bold text-emerald-400 shrink-0 shadow-inner">
          {channel.number}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{channel.name}</p>
          <p className="text-xs text-zinc-500 truncate mt-0.5">
            {channel.category || "Nacional"}
          </p>
        </div>
        {selected && (
          <Play aria-hidden="true" className="h-4 w-4 text-emerald-400 shrink-0 fill-current" />
        )}
      </button>
      <button
        type="button"
        onClick={() => onToggleFavorite(channel)}
        aria-label={channel.isFavorite ? `Quitar ${channel.name} de favoritos` : `Agregar ${channel.name} a favoritos`}
        aria-pressed={channel.isFavorite}
        className={`p-2 rounded-lg transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          channel.isFavorite ? "text-amber-400" : "text-zinc-600 hover:text-amber-400"
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
    setChannels((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, isFavorite: !c.isFavorite } : c))
    );
  }, []);

  const isSearchStale = searchQuery !== deferredSearchQuery;

  // Navegación por teclado / control remoto
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Atajos globales
      if (e.key === "m" || e.key === "M") {
        // Silenciar - el botón de mute está en el player, disparamos click
        const muteBtn = document.querySelector('[aria-label*="Silenciar"], [aria-label*="Activar sonido"]') as HTMLButtonElement | null;
        muteBtn?.click();
        return;
      }
      if (e.key === "f" || e.key === "F") {
        const fsBtn = document.querySelector('[aria-label="Pantalla completa (F)"]') as HTMLButtonElement | null;
        fsBtn?.click();
        return;
      }
      if (e.key === " " || e.key === "k" || e.key === "K") {
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
      // Flechas para navegar la lista
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedChannel((current) => {
          if (!current) return filteredChannels[0] ?? null;
          const idx = filteredChannels.findIndex((c) => c.id === current.id);
          const next = e.key === "ArrowDown"
            ? filteredChannels[Math.min(idx + 1, filteredChannels.length - 1)]
            : filteredChannels[Math.max(idx - 1, 0)];
          return next ?? current;
        });
      }
      if (e.key === "Enter") {
        // Si el foco está en la búsqueda, no interferir
        if (document.activeElement === searchRef.current) return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [channels, filteredChannels]);

  // Scroll al canal seleccionado
  useEffect(() => {
    if (!selectedChannel || !listRef.current) return;
    const selectedEl = listRef.current.querySelector(`[data-channel-id="${selectedChannel.id}"]`);
    selectedEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedChannel]);

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      {/* Resplandor decorativo de fondo */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 h-72 bg-gradient-to-b from-emerald-500/[.07] to-transparent" />

      <header className="relative mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
                <Tv aria-hidden="true" className="h-6 w-6 text-emerald-400" />
              </span>
              CanalCasa
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Plataforma de streaming HD con reproducción nativa
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowShortcuts((s) => !s)}
            aria-label="Ver atajos de teclado"
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Info aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[280px]">
            <Search aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Buscar por nombre o número..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Buscar canales"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
            {isSearchStale && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-emerald-500/40 border-t-emerald-400 animate-spin" aria-hidden="true" />
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <LogOut aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Panel de atajos */}
      {showShortcuts && (
        <div className="relative mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[.04] p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Atajos de control remoto</h2>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              aria-label="Cerrar atajos"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2 text-zinc-300">
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono">↑ ↓</kbd>
              Cambiar canal
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono">0-9</kbd>
              Ir al canal
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono">Espacio</kbd>
              Play / Pausa
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono">M</kbd>
              Silenciar
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono">F</kbd>
              Pantalla completa
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono">?</kbd>
              Mostrar atajos
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <kbd className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono">Esc</kbd>
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

              <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                    {selectedChannel.category || "General"}
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedChannel.isFavorite && (
                      <Star aria-hidden="true" className="h-4 w-4 text-amber-400 fill-current" />
                    )}
                    <span className="text-xs text-zinc-500 font-mono">
                      ID: #{selectedChannel.id}
                    </span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {selectedChannel.number}. {selectedChannel.name}
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  {selectedChannel.description || "Transmisión oficial en vivo."}
                </p>

                {(selectedChannel.currentProgram || selectedChannel.nextProgram) && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {selectedChannel.currentProgram && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[.06] p-4">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                          <Radio aria-hidden="true" className="h-3.5 w-3.5" />
                          En el aire
                        </p>
                        <p className="mt-1.5 text-sm font-semibold text-white">
                          {selectedChannel.currentProgram}
                        </p>
                        {typeof selectedChannel.progress === "number" && (
                          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-emerald-400 transition-[width] duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, selectedChannel.progress))}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {selectedChannel.nextProgram && (
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                          <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
                          Sigue
                        </p>
                        <p className="mt-1.5 text-sm font-semibold text-zinc-200">
                          {selectedChannel.nextProgram}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="aspect-video bg-zinc-900/60 rounded-2xl flex flex-col items-center justify-center border border-zinc-800 text-center p-6">
              <Tv aria-hidden="true" className="h-12 w-12 text-zinc-600 mb-3" />
              <p className="text-zinc-400 font-medium">Ningún canal seleccionado</p>
              <p className="text-xs text-zinc-600 mt-1">
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
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
                    : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-zinc-800/60"
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
                  : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-zinc-800/60"
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
              <div role="status" className="p-8 text-center text-zinc-500 text-sm bg-zinc-900/40 rounded-xl border border-zinc-800/50">
                No se encontraron canales que coincidan con la búsqueda.
              </div>
            )}
          </div>

          {/* Indicador de navegación TV */}
          <div className="hidden lg:flex items-center justify-center gap-4 text-[11px] text-zinc-600 pt-1">
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
              <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono">0-9</kbd>
              Canal directo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}