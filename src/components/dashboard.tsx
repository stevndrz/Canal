"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { Channel, ViewId } from "@/lib/types";
import type { CatalogSection } from "@/lib/catalog/types";
import { DEFAULT_PLAYBACK } from "@/lib/types";
import {
  CATEGORY_ORDER,
  canalDeArranque,
  canalesDeCasa,
  filterChannels,
} from "@/lib/channels";
import {
  claveDeCanal,
  estaCaido,
  ordenarPorSalud,
  registrarExito,
  registrarFallo,
  type MemoriaCaidos,
} from "@/lib/canales-caidos";
import {
  desempaquetarCanales,
  recuentosDe,
  type PaqueteCanales,
} from "@/lib/canales-empaquetados";
import { useRemoteInput, useSpatialNav } from "@/hooks/use-spatial-nav";
import {
  usePersistedJson,
  usePersistedRecents,
  usePersistedSet,
} from "@/hooks/use-persisted-set";
import { TopNav } from "@/components/shell/top-nav";
import { VistaActiva } from "@/components/vista-activa";
import { LiveCardSkeleton } from "@/components/live-card";

/**
 * El reproductor se carga solo en el navegador.
 *
 * `hls.js`/`mpegts.js` se evalúan al importarse y tocan `self`, que en el
 * servidor no existe: con un import normal, la página entera revienta con
 * `ReferenceError: self is not defined` y Vercel devuelve un 500 — es lo que
 * tumbó este mismo diseño la primera vez que se intentó desplegar.
 *
 * El reproductor incrustado vive en el shell, no dentro de una vista.
 *
 * Antes lo montaba Inicio, así que al pasar a Canales React lo desmontaba, la
 * conexión se cortaba y el canal se quedaba en silencio. Montado aquí, ocupa el
 * mismo sitio del árbol en las dos pestañas: React conserva la instancia, el
 * `<video>` no se recrea y la emisión sigue sin cortarse mientras se busca otro
 * canal. Es el mismo motivo por el que nunca hay dos reproductores a la vez.
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
  paquete,
  catalog,
}: {
  /**
   * Los canales, en formato de transporte. Ver `canales-empaquetados.ts`: no
   * son objetos porque casi la mitad del payload eran nombres de clave
   * repetidos 7.822 veces.
   */
  paquete: PaqueteCanales;
  catalog: CatalogSection[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shellRef = useRef<HTMLDivElement | null>(null);

  /**
   * El resto de la lista, cuando llega.
   *
   * El HTML solo trae los ~200 canales que Inicio y Canales pintan al abrir
   * (ver `posicionesIniciales`). Los otros 7.600 se piden aquí, ya con la
   * primera pantalla dibujada, a una ruta que **sí** se cachea en el borde.
   *
   * Mientras no llegue, la app funciona: se ve la tele, se navega, se abre la
   * ficha de un canal. Lo único que se queda corto es buscar y las categorías
   * de más abajo, y se arregla solo en cuanto entra.
   */
  const [completo, setCompleto] = useState<PaqueteCanales | null>(null);
  const datos = completo ?? paquete;

  useEffect(() => {
    // Sin recorte, el HTML ya traía todo (`CANALES_EN_HTML=todos`).
    if (!paquete.recorte) return undefined;
    // `fetch` es de Chromium 42 y el parque objetivo empieza en 53, pero si
    // alguna tele aún más vieja llega hasta aquí, se queda con sus 200 canales
    // en vez de reventar dentro de un efecto y tumbar el shell entero.
    if (typeof fetch === "undefined") return undefined;

    let vivo = true;
    fetch("/api/canales")
      .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
      .then((lista: PaqueteCanales | null) => {
        // En transición: reconstruir 7.822 objetos y repintar la lista no puede
        // colarse por delante de lo que esté haciendo quien está mirando.
        if (vivo && lista?.canales?.length) startTransition(() => setCompleto(lista));
      })
      .catch(() => {});

    return () => {
      vivo = false;
    };
  }, [paquete]);

  /**
   * Una sola pasada: reconstruye los objetos Y numera al estilo IPTV.
   *
   * Antes eran dos recorridos de 7.822 elementos: el servidor mandaba `id` y
   * `number`, y aquí `withChannelNumbers` clonaba los 7.822 objetos enteros
   * solo para reescribir el número que acababa de llegar.
   */
  const channels = useMemo(() => desempaquetarCanales(datos), [datos]);

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
  /**
   * El último canal que se estaba viendo, para abrir ahí la próxima vez.
   *
   * No puede leerse en el primer render —`localStorage` no existe en el
   * servidor— así que el arranque es el de siempre y el efecto de abajo lo
   * corrige en cuanto llega. Se guarda el nombre además del id porque el id es
   * posicional: ver `UltimoCanal`.
   */
  const [ultimo, guardarUltimo] = usePersistedJson("canalcasa:ultimo", { id: 0, nombre: "" });
  const [tunedId, setTunedId] = useState<number | null>(canalDeArranque(channels));
  /** Para no pisar al canal que la persona haya elegido mientras esto llegaba. */
  const arranqueAplicado = useRef(false);
  const [category, setCategory] = useState("Todas");
  const [search, setSearch] = useState("");
  /**
   * Los ajustes se guardan en el aparato.
   *
   * Estaban en un `useState` a secas, así que cada recarga los devolvía a
   * fábrica: alguien ponía «controles grandes» y al cerrar la app se perdía.
   * Es lo que separa una web de la tele de casa — se configura una vez.
   */
  const [settings, patchSettings] = usePersistedJson("canalcasa:ajustes", DEFAULT_PLAYBACK);

  /**
   * Qué canales han dejado de responder EN ESTE APARATO.
   *
   * De 7.822, muchos no responden nunca. El reproductor ya lo sabía y no lo
   * apuntaba en ningún sitio, así que se tropezaba con los mismos muertos una
   * y otra vez. Ver `canales-caidos.ts` para las tres reglas: dos fallos
   * seguidos, se olvidan a los siete días y se apartan sin esconderse.
   */
  const [caidos, guardarCaidos] = usePersistedJson<{ mapa: MemoriaCaidos }>(
    "canalcasa:caidos",
    { mapa: {} },
  );

  const favorites = usePersistedSet("canalcasa:favorites");
  const recents = usePersistedRecents("canalcasa:recents");

  useEffect(() => {
    if (arranqueAplicado.current || !ultimo.nombre || channels.length === 0) return;
    arranqueAplicado.current = true;
    const destino = canalDeArranque(channels, ultimo);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (destino) setTunedId(destino);
  }, [ultimo, channels]);

  useRemoteInput();

  // La hora es lo primero que se busca en un televisor.

  const tuned = useMemo(
    () => channels.find((channel) => channel.id === tunedId) ?? channels[0] ?? null,
    [channels, tunedId],
  );

  /**
   * Lista visible: alimenta la lista de Canales, la búsqueda y el zapping.
   *
   * Los que han dejado de responder bajan al final, sin desaparecer. También
   * afecta al zapeo, y eso es la mitad de la gracia: con el mando dejas de
   * pasar por los muertos.
   */
  const visible = useMemo(
    () =>
      ordenarPorSalud(
        filterChannels(channels, { search, category }),
        caidos.mapa,
        // eslint-disable-next-line react-hooks/purity -- el reloj decide qué ha caducado
        Date.now(),
      ),
    [channels, search, category, caidos],
  );

  /**
   * Los canales de la casa: los que se ven de cajón, arriba del todo.
   *
   * Ver `publicConfig.canalesDeCasa`. Salen igual en la tele, en el teléfono y
   * en el PC sin que nadie configure nada en su aparato.
   */
  const deLaCasa = useMemo(() => canalesDeCasa(channels), [channels]);

  /**
   * Los que están apartados ahora mismo, para poder marcarlos en la lista.
   *
   * Se calcula una vez aquí y no en cada fila: `estaCaido` mira el reloj y con
   * 7.822 filas eso serían 7.822 comprobaciones por render.
   */
  const idsCaidos = useMemo(() => {
    if (Object.keys(caidos.mapa).length === 0) return new Set<number>();
    // eslint-disable-next-line react-hooks/purity -- el reloj decide qué ha caducado
    const ahora = Date.now();
    const marcados = new Set<number>();
    for (const canal of channels) {
      if (estaCaido(caidos.mapa, claveDeCanal(canal.streamUrl), ahora)) marcados.add(canal.id);
    }
    return marcados;
  }, [channels, caidos]);

  /**
   * Lo que el reproductor va aprendiendo de cada canal.
   *
   * Llega del `onStateChange` de `StreamPlayer`, que es quien de verdad sabe
   * si arrancó o si dio error.
   */
  const anotarSalud = useCallback(
    (canalId: number, funciona: boolean) => {
      const canal = channels.find((item) => item.id === canalId);
      if (!canal?.streamUrl) return;
      const clave = claveDeCanal(canal.streamUrl);
      guardarCaidos((actual) => ({
        mapa: funciona
          ? registrarExito(actual.mapa, clave)
          : registrarFallo(actual.mapa, clave, Date.now()),
      }));
    },
    [channels, guardarCaidos],
  );

  const recentChannels = useMemo(
    () =>
      recents.ids
        .map((id) => channels.find((channel) => channel.id === id))
        .filter((channel): channel is Channel => Boolean(channel)),
    [recents.ids, channels],
  );

  /**
   * Las categorías y sus recuentos salen del paquete, no de los canales.
   *
   * Es lo que deja que la columna diga «Deportes 1.240» desde el primer
   * fotograma, aunque de Deportes solo hayan viajado veinte canales. Y de paso
   * quita dos recorridos de 7.822 elementos que se rehacían en cada cambio de
   * la lista: son doce números que el servidor ya tenía contados.
   */
  const categories = useMemo(
    () => ["Todas", ...CATEGORY_ORDER.filter((item) => datos.categorias.includes(item))],
    [datos],
  );

  const recuentos = useMemo(() => recuentosDe(datos), [datos]);

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
      // Con esto la app abre la próxima vez donde la dejaste. Y se marca como
      // aplicado para que lo guardado no vuelva a sobrescribir una elección.
      arranqueAplicado.current = true;
      guardarUltimo({ id: channel.id, nombre: channel.name });
    },
    [recents, guardarUltimo],
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

  /**
   * Recordar el silencio, pero solo si lo pidió una persona.
   *
   * El reproductor se silencia solo al arrancar —es la única forma de que
   * ningún navegador bloquee la reproducción— y vuelve a subir el sonido si
   * puede. Guardar cada uno de esos cambios escribiría ruido y acabaría
   * dejando la app muda para siempre en cuanto un arranque saliera torcido.
   * Aquí solo llegan los toques al botón de sonido.
   */
  const recordarSilencio = useCallback(
    (mudo: boolean) => patchSettings({ startUnmuted: !mudo }),
    [patchSettings],
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

  if (channels.length === 0) {
    return (
      <div className="grid h-dvh place-items-center px-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">No se pudo cargar la lista</h1>
          <p className="mt-3 text-[15px] text-muted">
            Revisa la variable <code className="font-mono text-muted">M3U_URL</code> o tu
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

  /** Las dos vistas que llevan la señal en directo encima. */
  const conReproductor = view === "home" || view === "canales";

  return (
    <div ref={shellRef} className="app-shell">
      {/* La barra desaparece durante la reproducción. Es `position: fixed` con
          z-index 60 y el reproductor va en z-50, así que sin esto flotaría
          por encima del vídeo. */}
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
              onSilencio={recordarSilencio}
              onSalud={anotarSalud}
            />
          </div>
        )}

        <VistaActiva
          view={view}
          channels={channels}
          visible={visible}
          tuned={tuned}
          favorites={favorites}
          recentChannels={recentChannels}
          catalog={catalog}
          deLaCasa={deLaCasa}
          idsCaidos={idsCaidos}
          categories={categories}
          recuentos={recuentos}
          totalCanales={datos.total}
          category={category}
          search={search}
          settings={settings}
          m3uSource={M3U_SOURCE}
          onCategoryChange={setCategory}
          onSearchChange={setSearch}
          onSelect={select}
          onTune={tune}
          onPatchSettings={patchSettings}
        />
      </section>

      {view === "player" && tuned && (
        <FullscreenPlayer
          channel={tuned}
          playlist={visible.length > 0 ? visible : channels}
          settings={settings}
          onTune={(next) => {
            setTunedId(next.id);
            recents.push(next.id);
          }}
          onSilencio={recordarSilencio}
          onExit={() => navigate(lastView === "player" ? "home" : lastView)}
        />
      )}
    </div>
  );
}

export default Dashboard;
