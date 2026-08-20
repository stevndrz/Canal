"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { Channel, PlaybackSettings, ViewId } from "@/lib/types";
import type { CatalogSection } from "@/lib/catalog/types";
import { DEFAULT_PLAYBACK } from "@/lib/types";
import { CATEGORY_ORDER, canalDeArranque, filterChannels, withChannelNumbers } from "@/lib/channels";
import { useRemoteInput, useSpatialNav } from "@/hooks/use-spatial-nav";
import { usePersistedRecents, usePersistedSet } from "@/hooks/use-persisted-set";
import { TopNav } from "@/components/shell/top-nav";
import { LiveCardSkeleton } from "@/components/live-card";
import { HomeView } from "@/components/views/home-view";
import { LiveTvView } from "@/components/livetv/live-tv-view";
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
/**
 * El reproductor incrustado vive en el shell, no dentro de una vista.
 *
 * Antes lo montaba Inicio, así que al pasar a Canales React lo desmontaba, la
 * conexión se cortaba y el canal se quedaba en silencio. Montado aquí, ocupa el
 * mismo sitio del árbol en las dos pestañas: React conserva la instancia, el
 * `<video>` no se recrea y la emisión sigue sin cortarse mientras se busca otro
 * canal. Es el mismo motivo por el que nunca hay dos reproductores a la vez.
 */
const LiveCard = dynamic(() => import("@/components/live-card").then((m) => m.LiveCard), {
  ssr: false,
  loading: () => <LiveCardSkeleton />,
});

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
export function Dashboard({
  initialChannels,
  catalog,
}: {
  initialChannels: Channel[];
  catalog: CatalogSection[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shellRef = useRef<HTMLDivElement | null>(null);

  const channels = useMemo(() => withChannelNumbers(initialChannels), [initialChannels]);

  // Arranca en Inicio, no en pantalla completa.
  //
  // El vídeo sigue siendo lo primero que se ve, pero dentro de la página: la
  // tarjeta en directo de Inicio ya trae señal al entrar. La pantalla completa
  // pasa a ser una decisión —doble clic, Enter o el botón— en vez de la puerta
  // de entrada, que no dejaba ver el resto de la aplicación sin salir antes.
  // `?vista=` deja que una ruta de fuera del shell —`/peliculas`— pida una
  // sección concreta al volver. Sin esto, su barra solo sabía volver a Inicio.
  const vistaPedida = searchParams.get("vista") as ViewId | null;
  const [view, setView] = useState<ViewId>(
    vistaPedida && vistaPedida !== "player" ? vistaPedida : "home",
  );
  const [lastView, setLastView] = useState<ViewId>("home");
  const [tunedId, setTunedId] = useState<number | null>(canalDeArranque(channels));
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

  /**
   * Cambiar de canal sin salir de donde estás.
   *
   * Es lo que hacen los rieles de Inicio: ya se está viendo la tele en la
   * tarjeta de arriba, así que elegir otro canal cambia lo que suena ahí. Saltar
   * a pantalla completa por tocar una tarjeta sería quitarle a la persona la
   * pantalla que estaba mirando.
   */
  const select = useCallback(
    (channel: Channel) => {
      setTunedId(channel.id);
      recents.push(channel.id);
    },
    [recents],
  );

  /** Sintonizar y ocupar la pantalla. Es lo que se pide desde la lista. */
  const tune = useCallback(
    (channel: Channel) => {
      select(channel);
      setView("player");
    },
    [select],
  );

  /** Zapear dentro de lo que se está mirando, en un sentido u otro. */
  const zap = useCallback(
    (delta: number) => {
      if (!tunedId) return;
      const lista = visible.length > 0 ? visible : channels;
      const actual = lista.findIndex((channel) => channel.id === tunedId);
      const destino = lista[(actual + delta + lista.length) % lista.length];
      if (destino) select(destino);
    },
    [tunedId, visible, channels, select],
  );

  const handleBack = useCallback(() => {
    if (view === "player") {
      // Igual que el botón "Volver a la guía": si se pidió pantalla completa
      // real hay que cerrarla antes, o el navegador se queda en fullscreen
      // mostrando la navegación por debajo.
      if (typeof document !== "undefined" && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      navigate(lastView === "player" ? "canales" : lastView);
    } else if (view !== "home") {
      navigate("home");
    }
  }, [view, lastView, navigate]);

  /** 0-9 del mando: salta a la centena de esa categoría (101, 201, …). */
  const handleDigit = useCallback(
    (digit: string) => {
      const match = channels.find((channel) => channel.number.startsWith(digit));
      if (match) tune(match);
    },
    [channels, tune],
  );

  // El shell scrollea la ventana, pero el reproductor a pantalla completa no
  // puede: si la página scrollea por debajo, el vídeo se despega del borde
  // superior al arrastrar. La marca en <html> es lo que globals.css consulta
  // para volver a bloquear el scroll mientras dura la reproducción.
  useEffect(() => {
    const root = document.documentElement;
    if (view === "player") root.setAttribute("data-player", "on");
    else root.removeAttribute("data-player");
    return () => root.removeAttribute("data-player");
  }, [view]);

  const { focusFirst } = useSpatialNav({
    rootRef: shellRef,
    onBack: handleBack,
    onDigit: handleDigit,
    enabled: view !== "player",
  });

  // Al cambiar de pantalla hay que dejar el foco en algún sitio. Un mando de
  // televisor no tiene Tab: sin nada enfocado, las flechas no tienen desde
  // dónde partir y parece que el mando no responde. Se espera un fotograma a
  // que la vista nueva esté montada.
  useEffect(() => {
    if (view === "player") return undefined;
    const id = window.setTimeout(focusFirst, 60);
    return () => window.clearTimeout(id);
  }, [view, focusFirst]);

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

  /* Contenedor de las vistas que todavía no están portadas al diseño.
     `.screen` pone el hueco superior que deja libre la barra fija; `tv-safe`,
     el margen lateral de televisor. Inicio no lo usa porque ya es un `.screen`
     por sí mismo. */
  const pantalla = "screen tv-safe";

  /** Las dos vistas que llevan la señal en directo encima. */
  const conReproductor = view === "home" || view === "canales";

  return (
    <div ref={shellRef} className="app-shell">
      {/* La barra desaparece durante la reproducción. Es `position: fixed` con
          z-index 60 y el reproductor va en z-50, así que sin esto flotaría
          por encima del vídeo. ARVIO hace lo mismo con su `activeStream`. */}
      {view !== "player" && <TopNav view={view} onNavigate={navigate} />}

      <section className="content">
        {/* Inicio y Canales comparten la señal en directo. En las demás vistas
            no se monta: nadie va a Ajustes a ver la tele, y así no se gasta
            ancho de banda en segundo plano. */}
        {conReproductor && tuned && (
          <div className="live-slot">
            <LiveCard
              channel={tuned}
              settings={settings}
              onExpand={tune}
              onNext={() => zap(1)}
              onPrev={() => zap(-1)}
            />
          </div>
        )}

        {view === "home" && (
          <HomeView
            sinHueco
            channels={channels}
            tuned={tuned}
            favorites={favorites.ids}
            recents={recentChannels}
            catalog={catalog}
            onSelect={select}
            onOpenTitle={(mediaType, id) => router.push(`/peliculas/${mediaType}/${id}`)}
          />
        )}

        {view === "canales" && (
          <LiveTvView
            sinHueco
            channels={channels}
            visible={visible}
            tuned={tuned}
            favorites={favorites.ids}
            categories={categories}
            category={category}
            search={search}
            onCategoryChange={setCategory}
            onSearchChange={setSearch}
            onTune={tune}
            onToggleFavorite={favorites.toggle}
          />
        )}

        {view === "favoritos" && (
          <FavoritosView
              channels={channels}
              favorites={favorites.ids}
              tunedId={tuned?.id ?? null}
              onTune={tune}
            />
        )}

        {view === "buscar" && (
          <BuscarView
              results={search ? visible : channels.slice(0, 24)}
              search={search}
              onSearchChange={setSearch}
              onTune={tune}
            />
        )}

        {view === "categorias" && (
          <CategoriasView channels={channels} onPick={pickCategory} />
        )}

        {view === "ajustes" && (
          <div className={pantalla}>
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

      </section>

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
          onExit={() => navigate(lastView === "player" ? "home" : lastView)}
        />
      )}
    </div>
  );
}

export default Dashboard;
