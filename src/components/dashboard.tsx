"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { Channel, ViewId } from "@/lib/types";
import type { FilaDeTarjetas } from "@/components/catalog/catalog-row";
import { DEFAULT_PLAYBACK } from "@/lib/types";
import {
  ampliarTramo,
  buscarUltimo,
  cadenaDeZapeo,
  canalDeArranque,
  canalesDeCasa,
  canalesDelTramo,
  stepChannel,
  tramoDeCanal,
  type SeccionZapeo,
  type TramoZapeo,
  type UltimoCanal,
} from "@/lib/channels";
import { indexarCanales, normalizarCasa, unirMisCanales } from "@/lib/secciones-canales";
import { publicConfig } from "@/lib/config";
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
import { useMarcado } from "@/hooks/use-marcado";
import { salirDeLaApp } from "@/lib/salir-de-la-app";
import { usePersistedJson } from "@/hooks/use-persisted-set";
import { useFavoritosDeCanal, useRecientesDeCanal } from "@/hooks/use-canales-guardados";
import { claveDeCanalEstable } from "@/lib/claves-canal";
import { TopNav } from "@/components/shell/top-nav";
import { VistaActiva } from "@/components/vista-activa";
import { LiveCardSkeleton } from "@/components/live-card-skeleton";

/**
 * `ssr: false` porque `hls.js`/`mpegts.js` tocan `self` al importarse: con un
 * import normal la página revienta con `ReferenceError: self is not defined` y
 * Vercel devuelve un 500. Tumbó el primer despliegue.
 *
 * Y vive en el shell, no dentro de una vista: montado por Inicio, pasar a
 * Canales lo desmontaba y la emisión se cortaba. Aquí ocupa el mismo sitio del
 * árbol en las dos pestañas, así que el `<video>` no se recrea.
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
  esTV,
}: {
  /**
   * Los canales, en formato de transporte. Ver `canales-empaquetados.ts`: no
   * son objetos porque casi la mitad del payload eran nombres de clave
   * repetidos 7.822 veces.
   */
  paquete: PaqueteCanales;
  catalog: FilaDeTarjetas[];
  /**
   * ¿Es el cascarón de Android TV o Tizen, o su navegador? Decidido en el
   * servidor con `esTelevisorUA` (ver `app/page.tsx`) y no aquí: si se leyera
   * `navigator.userAgent` en el cliente, el primer render del servidor
   * pintaría Inicio, el primero del cliente pintaría el reproductor, y React
   * marcaría un fallo de hidratación por una rama del árbol entera —Inicio
   * contra pantalla completa no son primos, son otra pantalla.
   */
  esTV: boolean;
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
   * Una sola pasada: reconstruye los objetos Y numera al estilo IPTV. Antes
   * eran dos recorridos de 7.822, el segundo clonándolos enteros para
   * reescribir un número que acababa de llegar.
   */
  const channels = useMemo(() => desempaquetarCanales(datos), [datos]);

  /**
   * En un navegador, Inicio: la pantalla completa es una decisión, no la
   * puerta de entrada.
   *
   * En el cascarón de un televisor, al revés. Ahí no hay nada más que ver:
   * quien abre la app quiere el canal puesto, no una portada con rieles que
   * hay que recorrer con el mando para llegar al mismo sitio. Salir de la
   * pantalla completa (Atrás) sigue llevando a Inicio como siempre —el menú
   * entero sigue a un botón de distancia, no se ha quitado nada—.
   *
   * `?vista=` manda sobre las dos: deja que una ruta de fuera del shell
   * —`/peliculas`— pida una sección concreta al volver.
   */
  const vistaPedida = searchParams.get("vista") as ViewId | null;
  const [view, setView] = useState<ViewId>(
    vistaPedida && vistaPedida !== "player" ? vistaPedida : esTV ? "player" : "home",
  );

  /**
   * La URL manda sobre la vista **también después de montar**: el `useState` de
   * arriba corre una vez, así que con el componente ya montado un `?vista=`
   * nuevo —botón Atrás, navegación recuperada— no movía nada.
   *
   * Se compara con el parámetro ANTERIOR y no con la vista actual, para no
   * pisar las vistas elegidas dentro del shell, que no tocan la URL.
   */
  const [vistaPrevia, setVistaPrevia] = useState(vistaPedida);
  if (vistaPedida !== vistaPrevia) {
    setVistaPrevia(vistaPedida);
    if (vistaPedida && vistaPedida !== "player") setView(vistaPedida);
  }
  const [lastView, setLastView] = useState<ViewId>("home");
  /**
   * El último canal que se estaba viendo, para abrir ahí la próxima vez.
   *
   * No puede leerse en el primer render —`localStorage` no existe en el
   * servidor— así que el arranque es el de siempre y el efecto de abajo lo
   * corrige en cuanto llega. Se guarda el nombre además del id porque el id es
   * posicional: ver `UltimoCanal`.
   */
  const [ultimo, guardarUltimo] = usePersistedJson<UltimoCanal>("canalcasa:ultimo", { id: 0, nombre: "" });
  const [tunedId, setTunedId] = useState<number | null>(canalDeArranque(channels));
  /** Para no pisar al canal que la persona haya elegido mientras esto llegaba. */
  const arranqueAplicado = useRef(false);
  /**
   * Lo escrito en Buscar, y solo eso. Antes había UNA búsqueda y UNA categoría
   * para toda la app: lo elegido en Canales filtraba Buscar («guate» no
   * encontraba nada con «Internacional» puesto allí) y el zapeo desde Inicio.
   * Canales lleva su tema y su búsqueda dentro; esta vive aquí solo para que
   * no se borre al ir y volver de la pestaña.
   */
  const [busqueda, setBusqueda] = useState("");
  /** Los ajustes se guardan en el aparato: la tele de casa se configura una vez. */
  const [settings, patchSettings] = usePersistedJson("canalcasa:ajustes", DEFAULT_PLAYBACK);

  /**
   * Qué canales han dejado de responder EN ESTE APARATO. De 7.822, muchos no
   * responden nunca, y sin apuntarlo el reproductor se tropezaba siempre con
   * los mismos. Reglas en `canales-caidos.ts`.
   */
  const [caidos, guardarCaidos] = usePersistedJson<{ mapa: MemoriaCaidos }>(
    "canalcasa:caidos",
    { mapa: {} },
  );

  /**
   * ¿Ya está aquí la lista entera? Sin recorte, el HTML la traía toda. Con
   * él, hasta que llega `/api/canales`.
   */
  const listaCompleta = !paquete.recorte || completo !== null;

  /** Por clave estable, no por posición: ver `claves-canal.ts`. */
  const favorites = useFavoritosDeCanal(channels, listaCompleta);
  const recents = useRecientesDeCanal(channels, listaCompleta);

  /**
   * Abrir en el último canal visto, en cuanto se sepa cuál es y esté en la
   * lista. Si el guardado no venía en el recorte del HTML NO se da por hecho:
   * antes sí, y con wifi flojo la tele abría siempre en Canal 7 aunque cuatro
   * segundos después llegara la lista con el canal de anoche. Ahora se espera
   * a la lista completa; solo con ella en la mano se rinde.
   */
  useEffect(() => {
    if (arranqueAplicado.current || !ultimo.nombre || channels.length === 0) return;
    const guardado = buscarUltimo(channels, ultimo);
    if (guardado !== null) {
      arranqueAplicado.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTunedId(guardado);
    } else if (listaCompleta) {
      arranqueAplicado.current = true;
    }
  }, [ultimo, channels, listaCompleta]);

  useRemoteInput();

  const tuned = useMemo(
    () => channels.find((channel) => channel.id === tunedId) ?? channels[0] ?? null,
    [channels, tunedId],
  );

  /**
   * Todos los canales con los caídos al final, sin desaparecer: con el mando
   * dejas de pasar por los muertos. Ya no la recorta ningún filtro del shell
   * (ver `busqueda`): alimenta Canales, que se organiza por dentro, y Buscar.
   */
  const visible = useMemo(
    () =>
      ordenarPorSalud(
        channels,
        caidos.mapa,
        // eslint-disable-next-line react-hooks/purity -- el reloj decide qué ha caducado
        Date.now(),
      ),
    [channels, caidos],
  );

  /**
   * Los de la casa, arriba del todo: iguales en la tele, el teléfono y el PC
   * sin configurar nada. Ver `publicConfig.canalesDeCasa`.
   */
  const deLaCasa = useMemo(() => canalesDeCasa(channels), [channels]);

  /**
   * Los apartados ahora mismo. Se calcula una vez aquí y no en cada fila:
   * `estaCaido` mira el reloj, y serían 7.822 comprobaciones por render.
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

  /** Lo que el reproductor aprende de cada canal, vía `onStateChange`. */
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
   * Los recuentos salen del paquete: así Canales dice «Ver los 527 de
   * Sudamérica» desde el primer fotograma aunque solo hayan viajado veinte.
   */
  const recuentos = useMemo(() => recuentosDe(datos), [datos]);

  /* ── Contexto de zapeo ────────────────────────────────────────────────
   *
   * Qué recorren ↑/↓ y Canal+/− a pantalla completa, ⏮/⏭ en el reproductor
   * de arriba y la guía. Antes era la lista entera (o la filtrada por
   * Canales), con vuelta al llegar al final: al arrancar la tele en Canal 7,
   * ↑↑ llevaba a un canal chino, el último de 4.816. Ahora es la sección
   * desde la que se eligió el canal (o los resultados de Buscar), y al
   * llegar a su final se suma la siguiente, nunca se da la vuelta. Al
   * arrancar: «Mis canales y Guatemala». Ver `channels.ts`. */

  const casaNormalizada = useMemo(() => normalizarCasa(publicConfig.canalesDeCasa), []);
  const misCanales = useMemo(
    () => unirMisCanales(deLaCasa, visible.filter((canal) => favorites.ids.has(canal.id))),
    [deLaCasa, visible, favorites.ids],
  );
  /** La cadena fija de secciones; se rehace al llegar la lista o cambiar un caído. */
  const cadena = useMemo(
    () => cadenaDeZapeo(indexarCanales(visible, casaNormalizada), misCanales, idsCaidos),
    [visible, casaNormalizada, misCanales, idsCaidos],
  );

  /**
   * `lista`: una lista suelta como contexto (los resultados de Buscar), por
   * ids para que sobreviva a la llegada de la lista completa. `tramo`: qué
   * secciones van en juego; `null` = «la del canal que suena».
   */
  const [zapeo, setZapeo] = useState<{
    lista: { titulo: string; ids: number[] } | null;
    tramo: TramoZapeo | null;
  }>({ lista: null, tramo: null });

  const secciones = useMemo<SeccionZapeo[]>(() => {
    if (!zapeo.lista) return cadena;
    const porId = new Map(channels.map((canal) => [canal.id, canal]));
    const canales = zapeo.lista.ids
      .map((id) => porId.get(id))
      .filter((canal): canal is Channel => Boolean(canal));
    return [{ clave: "lista", titulo: zapeo.lista.titulo, canales }];
  }, [zapeo.lista, cadena, channels]);

  /**
   * El contexto en uso: las secciones, el tramo y su lista ya aplanada (lo que
   * reciben el reproductor y la guía). Si el canal que suena no está en él
   * —una lista de Buscar que ya no lo trae—, el de su sección de siempre.
   */
  const contexto = useMemo(() => {
    if (!tuned) return { secciones: cadena, tramo: { desde: 0, hasta: 0 }, lista: [] as Channel[] };
    /**
     * `ampliarTramo` también aquí y no solo al zapear: si se ELIGE el último
     * canal de una sección (el último de Guatemala en Canales), el tramo
     * deducido acaba justo en él y la primera ↓ no tenía siguiente —ni el
     * reproductor ni la guía—: flecha muerta. Ampliado, ↓ sigue por la
     * sección vecina como cuando se llega zapeando.
     */
    const base = zapeo.tramo ?? tramoDeCanal(secciones, tuned.id);
    if (base) {
      const tramo = ampliarTramo(secciones, base, tuned.id);
      const lista = canalesDelTramo(secciones, tramo);
      if (lista.some((canal) => canal.id === tuned.id)) return { secciones, tramo, lista };
    }
    const deducido = tramoDeCanal(cadena, tuned.id);
    const propio = deducido ? ampliarTramo(cadena, deducido, tuned.id) : { desde: 0, hasta: 0 };
    const lista = canalesDelTramo(cadena, propio);
    return { secciones: cadena, tramo: propio, lista: lista.length > 0 ? lista : [tuned] };
  }, [tuned, zapeo.tramo, secciones, cadena]);

  const navigate = useCallback((next: ViewId) => {
    setView(next);
    if (next !== "player") setLastView(next);
  }, []);

  /**
   * Cambiar de canal sin salir de donde estás: los rieles de Inicio cambian lo
   * que suena en la tarjeta de arriba, sin saltar a pantalla completa.
   *
   * Depende de `recents.push` y **no del objeto `recents` entero**: `ids`
   * cambia en cada zapeo, y con el objeto en las dependencias `select` cambiaba
   * de identidad, y con él el `onOpen` de todas las tarjetas. El comparador de
   * `memo(MediaCard)` dejaba de acertar y se repintaban 121 tarjetas por un
   * cambio que afectaba a una fila. Medido: 121 renders pasaron a 1.
   */
  const anotarReciente = recents.push;

  /** Poner un canal: lo que hacen todas las rutas, se elija o se zapee. */
  const sintonizar = useCallback(
    (channel: Channel) => {
      setTunedId(channel.id);
      anotarReciente(channel.id);
      // Marcado como aplicado para que lo guardado no pise esta elección.
      arranqueAplicado.current = true;
      guardarUltimo({ id: channel.id, nombre: channel.name, clave: claveDeCanalEstable(channel) });
    },
    [anotarReciente, guardarUltimo],
  );

  /**
   * Elegir un canal (Inicio, Canales, el marcado): su contexto pasa a ser su
   * sección, que se deduce del propio canal (`tramo: null`).
   */
  const select = useCallback(
    (channel: Channel) => {
      sintonizar(channel);
      setZapeo({ lista: null, tramo: null });
    },
    [sintonizar],
  );

  /** Sintonizar y ocupar la pantalla. Es lo que se pide desde la lista. */
  const tune = useCallback(
    (channel: Channel) => {
      select(channel);
      setView("player");
    },
    [select],
  );

  /**
   * Ampliar el reproductor de arriba: el mismo canal a pantalla completa, sin
   * tocar el contexto. Con `tune` se reiniciaba, y lo que se venía zapeando
   * con ⏭ (una búsqueda, Centroamérica) se perdía al ampliar.
   */
  const expandir = useCallback(
    (channel: Channel) => {
      sintonizar(channel);
      setView("player");
    },
    [sintonizar],
  );

  /**
   * Desde Buscar: el contexto son los resultados, en su orden. ↓ recorre lo
   * que se buscó, no la sección del canal.
   */
  const tuneDesdeBusqueda = useCallback(
    (channel: Channel, resultados: Channel[], titulo: string) => {
      sintonizar(channel);
      setZapeo({ lista: { titulo, ids: resultados.map((canal) => canal.id) }, tramo: { desde: 0, hasta: 0 } });
      setView("player");
    },
    [sintonizar],
  );

  /**
   * Zapear deja el contexto donde está y, si se llegó a un extremo, le suma la
   * sección vecina (`ampliarTramo`). Lo usan ⏮/⏭ del reproductor de arriba y
   * la pantalla completa, que antes ni siquiera recordaba el último canal.
   */
  const alZapear = useCallback(
    (channel: Channel) => {
      sintonizar(channel);
      const mismas = contexto.secciones === secciones;
      setZapeo((actual) => ({
        lista: mismas ? actual.lista : null,
        tramo: ampliarTramo(contexto.secciones, contexto.tramo, channel.id),
      }));
    },
    [sintonizar, contexto, secciones],
  );

  /** Zapear dentro del contexto, en un sentido u otro, sin dar la vuelta. */
  const zap = useCallback(
    (delta: number) => {
      if (!tuned) return;
      const destino = stepChannel(contexto.lista, tuned.id, delta);
      if (destino) alZapear(destino);
    },
    [tuned, contexto.lista, alZapear],
  );

  /**
   * Recordar el silencio solo si lo pidió una persona. El reproductor se
   * silencia solo al arrancar —única forma de que ningún navegador bloquee la
   * reproducción—, y guardar eso dejaría la app muda para siempre en cuanto un
   * arranque saliera torcido. Aquí solo llegan los toques al botón.
   */
  const recordarSilencio = useCallback(
    (mudo: boolean) => patchSettings({ startUnmuted: !mudo }),
    [patchSettings],
  );

  const handleBack = useCallback(() => {
    if (view === "player") {
      // Hay que salir del fullscreen del navegador antes, o se queda en él
      // mostrando la navegación por debajo.
      if (typeof document !== "undefined" && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      navigate(lastView === "player" ? "canales" : lastView);
    } else if (view !== "home") {
      navigate("home");
    } else {
      /**
       * En Inicio ya no hay adónde volver, y en un navegador eso está bien:
       * la pestaña se cierra sola.
       *
       * Empaquetada en un televisor, no: el mando no tiene más salida que
       * Atrás, y comérsela aquí obliga a apagar la tele para salir. Samsung
       * además lo exige para publicar. En el navegador `salirDeLaApp`
       * devuelve `false` y esto sigue sin hacer nada, que es lo correcto ahí.
       */
      salirDeLaApp();
    }
  }, [view, lastView, navigate]);

  /**
   * 0-9 del mando: se marca el número del canal, como en una tele.
   *
   * Antes cada dígito saltaba al primer canal cuyo número empezara por él, así
   * que «3» llevaba al 301 y no había forma de llegar al 307. Cada fila lleva
   * su número escrito al lado; ahora teclearlo lleva ahí. Ver `lib/marcado.ts`.
   */
  const { marcado, noExiste, previsto, pulsarDigito } = useMarcado(channels, tune);

  // El vídeo se despega del borde superior si la página scrollea por debajo.
  // Esta marca en <html> es la que globals.css consulta para bloquearlo.
  useEffect(() => {
    const root = document.documentElement;
    if (view === "player") root.setAttribute("data-player", "on");
    else root.removeAttribute("data-player");
    return () => root.removeAttribute("data-player");
  }, [view]);

  const { focusFirst } = useSpatialNav({
    rootRef: shellRef,
    onBack: handleBack,
    onDigit: pulsarDigito,
    enabled: view !== "player",
  });

  // Un mando no tiene Tab: sin nada enfocado las flechas no tienen desde dónde
  // partir y parece que no responde. Se espera a que la vista nueva monte.
  //
  // Y a que llegue su trozo de código: Canales y Buscar se cargan aparte
  // (`vista-activa.tsx`), y a los 60 ms todavía puede estar el hueco de
  // «cargando», sin la entrada (`data-nav-entrada`) a la que ir. Se reintenta
  // mientras se vea ese hueco, con tope, en vez de dejar el foco en la barra.
  useEffect(() => {
    if (view === "player") return undefined;
    let intentos = 0;
    let id = 0;
    const intentar = () => {
      const cargando = shellRef.current?.querySelector("[data-vista-cargando]");
      if (cargando && intentos++ < 40) {
        id = window.setTimeout(intentar, 80);
        return;
      }
      focusFirst();
    };
    id = window.setTimeout(intentar, 60);
    return () => window.clearTimeout(id);
  }, [view, focusFirst]);

  if (channels.length === 0) {
    return (
      <div className="grid h-dvh place-items-center px-8 text-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">No se pudo cargar la lista</h1>
          <p className="mt-3 text-sm text-muted">
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
      {/* Fuera durante la reproducción: es `fixed` con z-60 y el reproductor
          va en z-50, así que si no flotaría por encima del vídeo. */}
      {view !== "player" && <TopNav view={view} onNavigate={navigate} />}

      {/* Lo que se está marcando, grande y arriba a la derecha, como en un
          televisor. Sin esto el marcado es invisible y no se sabe si el mando
          registró la tecla. `aria-live` para que también se anuncie.

          En la capa de diálogo (70) y no en la 50: la barra va en la 60 y,
          con la página desplazada, «Sin canal» asomaba por detrás de ella.
          Cristal SIN desenfoque: a pantalla completa va encima del vídeo. */}
      {(marcado || noExiste) && (
        <div
          className="pointer-events-none fixed right-[var(--margen)] top-[var(--margen)] z-[var(--capa-dialogo)] flex min-w-[5ch] flex-col items-end rounded-[var(--radio-md)] bg-[var(--cristal-fuerte)] px-6 py-4 text-right shadow-[var(--sombra-2)] ring-1 ring-[var(--borde-fuerte)]"
          role="status"
          aria-live="polite"
        >
          {noExiste ? (
            <span className="text-2xl font-semibold text-tinta-1">Sin canal</span>
          ) : (
            <>
              {/* El número, lo más grande de la pantalla: se lee a tres metros. */}
              <span className="text-[calc(var(--texto-3xl)*1.8)] font-bold leading-none tabular-nums tracking-wide text-tinta-1">
                {marcado}
              </span>
              <span className="mt-2 max-w-[18ch] truncate text-lg text-tinta-2">
                {previsto ? previsto.name : "…"}
              </span>
            </>
          )}
        </div>
      )}

      <section className="content">
        {/* Solo Inicio y Canales: en las demás no se monta, y así no se gasta
            ancho de banda en segundo plano. */}
        {conReproductor && tuned && (
          <div className="live-slot">
            <LiveCard
              channel={tuned}
              settings={settings}
              onExpand={expandir}
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
          recuentos={recuentos}
          totalCanales={datos.total}
          busqueda={busqueda}
          settings={settings}
          m3uSource={M3U_SOURCE}
          onBusquedaChange={setBusqueda}
          onSelect={select}
          onTune={tune}
          onTuneDesdeBusqueda={tuneDesdeBusqueda}
          onPatchSettings={patchSettings}
        />
      </section>

      {view === "player" && tuned && (
        <FullscreenPlayer
          channel={tuned}
          // El contexto de zapeo, no la lista entera: lo que recorren ↑/↓ y
          // lo que enseña la guía. Ver `contexto`.
          playlist={contexto.lista}
          settings={settings}
          onTune={alZapear}
          onSilencio={recordarSilencio}
          onExit={() => navigate(lastView === "player" ? "home" : lastView)}
        />
      )}
    </div>
  );
}

export default Dashboard;
