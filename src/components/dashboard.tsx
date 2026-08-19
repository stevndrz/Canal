"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { Channel, PlaybackSettings, ViewId } from "@/lib/types";
import { DEFAULT_PLAYBACK } from "@/lib/types";
import { CATEGORY_ORDER, filterChannels, withChannelNumbers } from "@/lib/channels";
import { useRemoteInput, useSpatialNav } from "@/hooks/use-spatial-nav";
import { usePersistedRecents, usePersistedSet } from "@/hooks/use-persisted-set";
import { AppBottomNav, AppSidebar } from "@/components/app-nav";
import { HomeView } from "@/components/views/home-view";
import { CanalesView } from "@/components/views/canales-view";
import { FavoritosView } from "@/components/views/favoritos-view";
import { BuscarView } from "@/components/views/buscar-view";
import { CategoriasView } from "@/components/views/categorias-view";
import { AjustesView } from "@/components/views/ajustes-view";

/**
 * El reproductor se carga solo en el navegador.
 *
 * `hls.js`/`mpegts.js` se evalúan al importarse y tocan `self`, que en el
 * servidor no existe: con un import normal, la página entera revienta con
 * `ReferenceError: self is not defined` y Vercel devuelve un 500 — es lo que
 * tumbó este mismo diseño la primera vez que se intentó desplegar.
 */
const FullscreenPlayer = dynamic(
  () => import("@/components/fullscreen-player").then((m) => m.FullscreenPlayer),
  { ssr: false, loading: () => <div className="fixed inset-0 z-50 bg-app" /> }
);

const M3U_SOURCE = "gist.githubusercontent.com/stevndrz/…/gt.m3u";

/**
 * App Shell de CanalCasa.
 *
 * Reglas del shell:
 * - La ventana NO scrollea (body overflow:hidden en globals.css). El scroll
 *   vive en el contenedor de cada vista, así el sidebar y la barra inferior
 *   quedan fijos como en una app nativa.
 * - Una sola fuente de verdad para el canal sintonizado, compartida por el
 *   panel de Canales y el reproductor a pantalla completa.
 * - El mando se maneja en un solo sitio: useSpatialNav para mover el foco,
 *   este componente para Atrás y los dígitos de canal directo.
 */
export function Dashboard({ initialChannels }: { initialChannels: Channel[] }) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement | null>(null);

  const channels = useMemo(() => withChannelNumbers(initialChannels), [initialChannels]);

  const [view, setView] = useState<ViewId>("home");
  const [lastView, setLastView] = useState<ViewId>("home");
  const [tunedId, setTunedId] = useState<number | null>(channels[0]?.id ?? null);
  const [category, setCategory] = useState("Todas");
  const [search, setSearch] = useState("");
  const [settings, setSettings] = useState<PlaybackSettings>(DEFAULT_PLAYBACK);
  const [clock, setClock] = useState("");

  const favorites = usePersistedSet("canalcasa:favorites");
  const recents = usePersistedRecents("canalcasa:recents");

  useRemoteInput();

  // Reloj de la cabecera: la hora es lo primero que se busca en una TV.
  useEffect(() => {
    const update = () =>
      setClock(
        new Date().toLocaleTimeString("es-GT", { hour: "numeric", minute: "2-digit" }),
      );
    update();
    const timer = setInterval(update, 20_000);
    return () => clearInterval(timer);
  }, []);

  const tuned = useMemo(
    () => channels.find((channel) => channel.id === tunedId) ?? channels[0] ?? null,
    [channels, tunedId],
  );

  /** Lista visible: alimenta la lista de Canales, la búsqueda y el zapping. */
  const visible = useMemo(
    () => filterChannels(channels, { search, category }),
    [channels, search, category],
  );

  const recentChannels = useMemo(
    () =>
      recents.ids
        .map((id) => channels.find((channel) => channel.id === id))
        .filter((channel): channel is Channel => Boolean(channel)),
    [recents.ids, channels],
  );

  const categories = useMemo(
    () => [
      "Todas",
      ...CATEGORY_ORDER.filter((item) => channels.some((channel) => channel.category === item)),
    ],
    [channels],
  );

  const navigate = useCallback((next: ViewId) => {
    setView(next);
    if (next !== "player") setLastView(next);
  }, []);

  /** Sintonizar = pantalla completa. Es lo que se espera desde el sofá. */
  const tune = useCallback(
    (channel: Channel) => {
      setTunedId(channel.id);
      recents.push(channel.id);
      setView("player");
    },
    [recents],
  );

  const handleBack = useCallback(() => {
    if (view === "player") navigate(lastView);
    else if (view !== "home") navigate("home");
  }, [view, lastView, navigate]);

  /** 0-9 del mando: salta a la centena de esa categoría (101, 201, …). */
  const handleDigit = useCallback(
    (digit: string) => {
      const match = channels.find((channel) => channel.number.startsWith(digit));
      if (match) tune(match);
    },
    [channels, tune],
  );

  useSpatialNav({
    rootRef: shellRef,
    onBack: handleBack,
    onDigit: handleDigit,
    enabled: view !== "player",
  });

  const pickCategory = useCallback(
    (next: string) => {
      setCategory(next);
      navigate("canales");
    },
    [navigate],
  );

  const patchSettings = useCallback(
    (patch: Partial<PlaybackSettings>) => setSettings((current) => ({ ...current, ...patch })),
    [],
  );

  if (channels.length === 0) {
    return (
      <div className="grid h-dvh place-items-center px-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">No se pudo cargar la lista</h1>
          <p className="mt-3 text-[15px] text-zinc-400">
            Revisa la variable <code className="font-mono text-zinc-300">M3U_URL</code> o tu
            conexión, y vuelve a intentarlo.
          </p>
          <button
            type="button"
            data-nav="button"
            autoFocus
            onClick={() => router.refresh()}
            className="mt-7 inline-flex min-h-[50px] items-center rounded-2xl bg-accent px-7 text-base font-medium text-accent-on"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  /** Vistas con scroll simple comparten el mismo contenedor con padding de TV. */
  const scrollShell = "scroll-thin tv-safe flex-1 overflow-y-auto pt-7 pb-28 md:pb-7 xl:pt-10";

  return (
    <div ref={shellRef} className="relative flex h-dvh overflow-hidden bg-app text-accent">
      <AppSidebar
        view={view}
        onNavigate={navigate}
        channelCount={channels.length}
        categoryCount={categories.length - 1}
        clock={clock}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        {view === "home" && (
          <div className={scrollShell}>
            <HomeView
              channels={channels}
              tuned={tuned}
              favorites={favorites.ids}
              recents={recentChannels}
              onTune={tune}
              onToggleFavorite={favorites.toggle}
            />
          </div>
        )}

        {view === "canales" && (
          <div className="tv-safe flex min-h-0 flex-1 flex-col pt-7 pb-28 md:pb-7 xl:pt-10">
            <CanalesView
              channels={visible}
              tuned={tuned}
              favorites={favorites.ids}
              categories={categories}
              category={category}
              search={search}
              onCategoryChange={setCategory}
              onTune={tune}
              onToggleFavorite={favorites.toggle}
              onOpenSearch={() => navigate("buscar")}
            />
          </div>
        )}

        {view === "favoritos" && (
          <div className={scrollShell}>
            <FavoritosView
              channels={channels}
              favorites={favorites.ids}
              tunedId={tuned?.id ?? null}
              onTune={tune}
            />
          </div>
        )}

        {view === "buscar" && (
          <div className="tv-safe flex min-h-0 flex-1 flex-col pt-7 pb-28 md:pb-7 xl:pt-10">
            <BuscarView
              results={search ? visible : channels.slice(0, 24)}
              search={search}
              onSearchChange={setSearch}
              onTune={tune}
            />
          </div>
        )}

        {view === "categorias" && (
          <div className={scrollShell}>
            <CategoriasView channels={channels} onPick={pickCategory} />
          </div>
        )}

        {view === "ajustes" && (
          <div className={scrollShell}>
            <AjustesView
              settings={settings}
              onChange={patchSettings}
              channelCount={channels.length}
              favoriteCount={favorites.ids.size}
              onClearFavorites={favorites.clear}
              onRefresh={() => router.refresh()}
              m3uSource={M3U_SOURCE}
            />
          </div>
        )}

        <AppBottomNav view={view} onNavigate={navigate} />
      </main>

      {view === "player" && tuned && (
        <FullscreenPlayer
          channel={tuned}
          playlist={visible.length > 0 ? visible : channels}
          favorites={favorites.ids}
          settings={settings}
          clock={clock}
          onTune={(next) => {
            setTunedId(next.id);
            recents.push(next.id);
          }}
          onToggleFavorite={favorites.toggle}
          onExit={() => navigate(lastView === "player" ? "canales" : lastView)}
        />
      )}
    </div>
  );
}

export default Dashboard;
