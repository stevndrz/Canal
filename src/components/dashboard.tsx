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
  Trash2,
  SkipBack,
  SkipForward,
  Volume1,
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
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const streamUrl = channel.streamUrl;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    setStreamError(false);
    setNeedsUserGesture(false);
    video.muted = false;
    setIsMuted(false);
    video.src = streamUrl;
    video.load();

    const tryPlay = () => {
      video.play().then(() => {
        if (!cancelled) setIsPlaying(true);
      }).catch(() => {
        if (cancelled) return;
        // El navegador bloqueó el autoplay con audio.
        // NO muteamos — mostramos un overlay pidiendo un click.
        setNeedsUserGesture(true);
        setIsPlaying(false);
      });
    };

    tryPlay();

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

  const handleEnableSound = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setNeedsUserGesture(false);
    video.muted = false;
    setIsMuted(false);
    video.play().then(() => setIsPlaying(true)).catch(() => setStreamError(true));
  }, []);

  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-slate-200 group"
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

      {/* Header flotante */}
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
        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-100 backdrop-blur-md border border-emerald-500/30">
          <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
          <span>Reproducción Nativa</span>
        </div>
      </div>

      {/* Controles del reproductor */}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 flex items-center justify-between transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? "Pausar (espacio)" : "Reproducir (espacio)"}
            className="p-3 rounded-xl bg-white/15 hover:bg-white/20 text-white backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {isPlaying ? <Pause aria-hidden="true" className="h-5 w-5" /> : <Play aria-hidden="true" className="h-5 w-5" />}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? "Activar sonido (M)" : "Silenciar (M)"}
            aria-pressed={isMuted}
            className="p-3 rounded-xl bg-white/15 hover:bg-white/20 text-white backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            {isMuted ? <VolumeX aria-hidden="true" className="h-5 w-5" /> : <Volume2 aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>

        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label="Pantalla completa (F)"
          className="p-3 rounded-xl bg-white/15 hover:bg-white/20 text-white backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <Maximize aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>

      {needsUserGesture && !streamError && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 p-6 text-center z-10">
          <Volume1 aria-hidden="true" className="h-14 w-14 text-teal-600 mb-4 animate-pulse" />
          <p className="text-xl font-bold text-white mb-1">Activar sonido</p>
          <p className="text-sm text-slate-500 max-w-sm mb-5">
            Presiona para reproducir con audio.
          </p>
          <button
            type="button"
            onClick={handleEnableSound}
            className="btn-primary text-base px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-teal-600/20 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            🔊 Activar sonido
          </button>
        </div>
      )}

      {streamError && (
        <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 p-6 text-center z-10">
          <Radio aria-hidden="true" className="h-12 w-12 text-red-500 mb-3 animate-pulse" />
          <p className="text-lg font-bold text-white">Error de Reproducción</p>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mb-4">
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
  onDelete,
  editMode,
}: {
  channel: Channel;
  selected: boolean;
  onSelect: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
  onDelete: (channel: Channel) => void;
  editMode: boolean;
}) {
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
        <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-teal-600 shrink-0 shadow-inner">
          {channel.number}
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
      {editMode && (
        <button
          type="button"
          onClick={() => onDelete(channel)}
          aria-label={`Eliminar ${channel.name}`}
          className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
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
  const [editMode, setEditMode] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Channel | null>(null);
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

  const handleDeleteChannel = useCallback(async (channel: Channel) => {
    try {
      await fetch(`/api/channels/${channel.id}`, { method: "DELETE" });
      setChannels((prev) => {
        const next = prev.filter((c) => c.id !== channel.id);
        if (selectedChannel?.id === channel.id) {
          setSelectedChannel(next[0] ?? null);
        }
        return next;
      });
      setPendingDelete(null);
    } catch {
      // Si falla la API, eliminamos localmente igual
      setChannels((prev) => {
        const next = prev.filter((c) => c.id !== channel.id);
        if (selectedChannel?.id === channel.id) {
          setSelectedChannel(next[0] ?? null);
        }
        return next;
      });
      setPendingDelete(null);
    }
  }, [selectedChannel]);

  const isSearchStale = searchQuery !== deferredSearchQuery;

  // Navegación por teclado / control remoto (TV)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Si hay confirmación de eliminación pendiente, Enter/Space confirma, Esc cancela
      if (pendingDelete) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleDeleteChannel(pendingDelete);
          return;
        }
        if (e.key === "Escape" || e.key === "Backspace") {
          setPendingDelete(null);
          return;
        }
        return;
      }

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
        setEditMode(false);
        return;
      }
      if (e.key === "?") {
        setShowShortcuts((s) => !s);
        return;
      }
      if (e.key === "Delete" || e.key === "Supr") {
        setEditMode((m) => !m);
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
        // Navegar entre categorías
        setSelectedCategory((current) => {
          const idx = categories.indexOf(current);
          const delta = e.key === "ArrowRight" ? 1 : -1;
          const nextIdx = (idx + delta + categories.length) % categories.length;
          return categories[nextIdx];
        });
        return;
      }

      // Enter selecciona el canal actual
      if (e.key === "Enter") {
        if (document.activeElement === searchRef.current) return;
        // Ya está seleccionado - no hacer nada (o toggle favorito en edit mode)
        if (editMode && selectedChannel) {
          handleToggleFavorite(selectedChannel);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [channels, filteredChannels, categories, pendingDelete, handleDeleteChannel, handleToggleFavorite, editMode, selectedChannel]);

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
          <button
            type="button"
            onClick={() => setEditMode((m) => !m)}
            aria-pressed={editMode}
            className={`px-3 py-2.5 rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-bold flex items-center gap-1.5 ${
              editMode
                ? "bg-red-500/15 border-red-500/40 text-red-400"
                : "bg-white border-slate-200 text-slate-500 hover:text-slate-950 hover:border-slate-300"
            }`}
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
            {editMode ? "Editando" : "Editar"}
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
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-red-400 hover:border-red-500/40 transition focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <LogOut aria-hidden="true" className="h-5 w-5" />
          </button>
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
              <kbd className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs font-mono">Supr</kbd>
              Modo edición
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

      {/* Confirmación de eliminación */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-500/15 text-red-400">
                <Trash2 aria-hidden="true" className="h-5 w-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-950">¿Eliminar canal?</h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              <strong className="text-slate-950">{pendingDelete.number}. {pendingDelete.name}</strong> se eliminará de tu lista.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleDeleteChannel(pendingDelete)}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold transition focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                Sí, eliminar
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition focus:outline-none focus:ring-2 focus:ring-zinc-500"
              >
                Cancelar
              </button>
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
                  <div className="flex items-center gap-2">
                    {selectedChannel.isFavorite && (
                      <Star aria-hidden="true" className="h-4 w-4 text-amber-400 fill-current" />
                    )}
                    <span className="text-xs text-slate-500 font-mono">
                      ID: #{selectedChannel.id}
                    </span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-950 mb-2">
                  {selectedChannel.number}. {selectedChannel.name}
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {selectedChannel.description || "Transmisión oficial en vivo."}
                </p>

                {(selectedChannel.currentProgram || selectedChannel.nextProgram) && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {selectedChannel.currentProgram && (
                      <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-teal-600">
                          <Radio aria-hidden="true" className="h-3.5 w-3.5" />
                          En el aire
                        </p>
                        <p className="mt-1.5 text-sm font-semibold text-slate-950">
                          {selectedChannel.currentProgram}
                        </p>
                        {typeof selectedChannel.progress === "number" && (
                          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/15">
                            <div
                              className="h-full rounded-full bg-emerald-400 transition-[width] duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, selectedChannel.progress))}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {selectedChannel.nextProgram && (
                      <div className="rounded-xl border border-slate-200 bg-white/60 p-4">
                        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" />
                          Sigue
                        </p>
                        <p className="mt-1.5 text-sm font-semibold text-slate-700">
                          {selectedChannel.nextProgram}
                        </p>
                      </div>
                    )}
                  </div>
                )}
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

          {editMode && (
            <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
              Modo edición: presiona 🗑 para eliminar un canal
            </div>
          )}

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
                    onDelete={setPendingDelete}
                    editMode={editMode}
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
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono">Supr</kbd>
              Editar
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}