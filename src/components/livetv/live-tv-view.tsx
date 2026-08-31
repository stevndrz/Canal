"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { CalendarClock, List, Search, X } from "lucide-react";
import type { Channel } from "@/lib/types";
import { QUE_SE_PINTA } from "@/lib/canales-empaquetados";
import {
  calcularVentana,
  ventanaCambio,
  type Ventana,
} from "@/lib/ventana-lista";
import { ChannelRow } from "./channel-row";
import { ParrillaEpg } from "./parrilla-epg";
import { PanelCanal } from "./panel-canal";
import { useInstante } from "@/hooks/use-reloj";

/**
 * Canales: categorías, lista y detalle.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/livetv/LiveTvScreen.tsx
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b):
 *   - Fuera la gestión de listas de reproducción. En el origen se añaden y
 *     quitan listas M3U desde la propia pantalla; en CanalCasa la lista se
 *     configura con la variable `M3U_URL` y no hay nada que administrar aquí.
 *   - El conmutador Lista/Parrilla SÍ está, aunque estuvo aplazado mucho
 *     tiempo («decidido dejarlo para una tanda posterior»). La parrilla es
 *     propia, no la del origen: aquí la programación no viaja con la lista
 *     —`Channel` no puede engordar, ver `types.ts`— así que se pide por
 *     ventana de canales a `/api/guia`. Ver `parrilla-epg.tsx`.
 *   - Fuera Catch-up, el lanzamiento en VLC y los avisos de Xtream, que
 *     dependen de infraestructura que esta app no tiene.
 *   - Textos en español y filtrado delegado al shell, que ya lo hacía.
 *
 * Se conservan sus nombres de clase al pie de la letra: son el contrato con
 * el CSS del shell.
 */

/**
 * Cuántas filas se pintan de golpe antes de pedir más al llegar abajo.
 *
 * Sale de `QUE_SE_PINTA` porque **es también lo que el servidor manda en el
 * HTML**: subirlo aquí sin subirlo allí dejaría la lista corta hasta que
 * llegara el resto de la lista. Un solo número, un solo sitio.
 */
const LOTE = QUE_SE_PINTA.lote;

/** El `gap` de `.livetv-rows` en `shell.css`. Cuenta para el alto de fila. */
const HUECO_FILA = 4;

/**
 * Antes de medir nada se monta todo, que es el comportamiento de siempre.
 * `calcularVentana` recorta en cuanto hay una fila de la que sacar el alto.
 */
const VENTANA_INICIAL: Ventana = { desde: 0, hasta: LOTE, huecoArriba: 0, huecoAbajo: 0 };

interface LiveTvViewProps {
  /**
   * Cuántos canales tiene cada categoría en la lista COMPLETA.
   *
   * Viene contado del servidor en vez de recorrer los canales aquí: el HTML
   * solo trae los que se pintan al abrir (ver `canales-empaquetados.ts`), así
   * que contar sobre lo recibido diría «Deportes 20» durante el primer segundo.
   */
  recuentos: Map<string, number>;
  /** Total de la lista completa. Es el número grande de la cabecera. */
  totalCanales: number;
  /**
   * Los canales que se ven de cajón, los primeros de «Todas».
   *
   * Solo ahí: dentro de una categoría concreta o con una búsqueda escrita,
   * subirlos sería contestar otra pregunta distinta de la que se hizo.
   */
  deLaCasa: Channel[];
  /**
   * Los que han dejado de responder en este aparato.
   *
   * Se marcan, **no se esconden**: estos canales resucitan constantemente y
   * quien quiera probar uno lo tiene al final de su lista. Ver
   * `canales-caidos.ts`.
   */
  idsCaidos: Set<number>;
  /** Los que pasan el filtro actual de categoría y búsqueda. */
  visible: Channel[];
  tuned: Channel | null;
  favorites: Set<number>;
  categories: string[];
  category: string;
  search: string;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  /** Sintonizar sin salir de la lista: la señal de arriba cambia de canal. */
  onSelect: (channel: Channel) => void;
  /** Sintonizar y ocupar la pantalla. Solo desde el botón del panel. */
  onTune: (channel: Channel) => void;
  onToggleFavorite: (id: number) => void;
  /** El shell ya pintó la señal en directo encima; no repetir el hueco. */
  sinHueco?: boolean;
}

export function LiveTvView({
  recuentos,
  totalCanales,
  deLaCasa,
  idsCaidos,
  visible,
  tuned,
  favorites,
  categories,
  category,
  search,
  onCategoryChange,
  onSearchChange,
  onSelect,
  onTune,
  onToggleFavorite,
  sinHueco,
}: LiveTvViewProps) {
  /**
   * Elegir un canal cambia la señal de arriba sin mover la lista. Saltar a
   * pantalla completa convertía explorar en un viaje de ida: para probar otro
   * canal había que salir, volver a Canales y buscar dónde estabas.
   */
  const sintonizar = useCallback(
    (canal: Channel) => {
      onSelect(canal);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onSelect],
  );

  /**
   * Lista o parrilla. **La lista manda por defecto**, y no es indecisión: es
   * la que funciona siempre. La parrilla depende de que haya guía EPG
   * configurada, y el caso por defecto de esta app es no tenerla — abrir en una
   * rejilla vacía sería una primera impresión falsa.
   */
  const [modo, setModo] = useState<"lista" | "parrilla">("lista");
  const instante = useInstante();

  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  // Estables, para que el `memo` de `ChannelRow` sirva de algo. Ver allí.
  const enfocarFila = useCallback((canal: Channel) => setSeleccionado(canal.id), []);
  const alternarFavorito = useCallback(
    (canal: Channel) => onToggleFavorite(canal.id),
    [onToggleFavorite],
  );
  const [pintadas, setPintadas] = useState(LOTE);
  const centinela = useRef<HTMLDivElement | null>(null);
  const contenedorFilas = useRef<HTMLDivElement | null>(null);
  const [ventana, setVentana] = useState<Ventana>(VENTANA_INICIAL);

  // Cambiar de categoría o buscar reinicia el recorte durante el render: con un
  // efecto se pintaría un fotograma con las filas de la categoría anterior.
  const [filtroPrevio, setFiltroPrevio] = useState(`${category}|${search}`);
  const filtroActual = `${category}|${search}`;
  if (filtroPrevio !== filtroActual) {
    setFiltroPrevio(filtroActual);
    setPintadas(LOTE);
  }

  // Pintar 500 filas de golpe cuesta cientos de milisegundos en un televisor.
  // Se pintan por lotes y el siguiente entra cuando el centinela del final se
  // asoma: paginación progresiva sin cortes para quien hace scroll.
  useEffect(() => {
    const nodo = centinela.current;
    if (!nodo || typeof IntersectionObserver === "undefined") return undefined;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setPintadas((actual) => Math.min(actual + LOTE, visible.length));
        }
      },
      { rootMargin: "600px" },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [visible.length]);

  /**
   * El lote manda cuántas filas EXISTEN; la ventana, cuántas se montan. Hacen
   * falta las dos: el lote evita calcular 7.822 posiciones al abrir, y la
   * ventana evita que tras bajar un rato queden montadas para siempre —eran
   * ~141.000 nodos y 15.650 `[data-nav]`, que `use-spatial-nav` recorre con
   * `getBoundingClientRect()` **en cada pulsación de flecha**—.
   */
  /**
   * Los canales de la casa, arriba del todo. Solo en «Todas» y sin búsqueda:
   * si alguien pidió Deportes, subirle el Canal 3 es contestar otra pregunta.
   *
   * **Manda sobre el apartado de los caídos, a propósito**: si Guatevisión no
   * responde hoy sigue siendo el canal de siempre, y nadie quiere buscarlo
   * entre 7.822 para ver si volvió. Se queda con su marca de «sin señal».
   */
  const conLaCasaDelante = useMemo(() => {
    if (category !== "Todas" || search.trim() || deLaCasa.length === 0) return visible;
    const suyos = new Set(deLaCasa.map((canal) => canal.id));
    const presentes = deLaCasa.filter((canal) => visible.some((item) => item.id === canal.id));
    if (presentes.length === 0) return visible;
    return [...presentes, ...visible.filter((canal) => !suyos.has(canal.id))];
  }, [visible, deLaCasa, category, search]);

  const enLote = useMemo(
    () => conLaCasaDelante.slice(0, pintadas),
    [conLaCasaDelante, pintadas],
  );
  const filas = useMemo(
    () => enLote.slice(ventana.desde, ventana.hasta),
    [enLote, ventana.desde, ventana.hasta],
  );

  /**
   * Recalcular la ventana al desplazarse.
   *
   * El alto de fila se mide de la primera montada en vez de codificarlo: es
   * `clamp()` contra el viewport, así que en un televisor no vale lo mismo que
   * en un teléfono. Mientras no haya nada que medir, `calcularVentana` devuelve
   * la lista entera — el comportamiento de antes, que es el seguro.
   *
   * `requestAnimationFrame` para no hacer un `setState` por cada evento de
   * desplazamiento, y `ventanaCambio` para no repintar cuando los índices no se
   * han movido.
   */
  useEffect(() => {
    const contenedor = contenedorFilas.current;
    if (!contenedor) return undefined;

    let pendiente = 0;
    const recalcular = () => {
      pendiente = 0;
      const primera = contenedor.firstElementChild as HTMLElement | null;
      const altoFila = primera ? primera.getBoundingClientRect().height + HUECO_FILA : 0;
      const siguiente = calcularVentana({
        desplazamiento: window.scrollY,
        alto: window.innerHeight,
        inicioLista: contenedor.getBoundingClientRect().top + window.scrollY,
        altoFila,
        total: enLote.length,
      });
      setVentana((actual) => (ventanaCambio(actual, siguiente) ? siguiente : actual));
    };

    const alDesplazar = () => {
      if (pendiente) return;
      pendiente = requestAnimationFrame(recalcular);
    };

    recalcular();
    window.addEventListener("scroll", alDesplazar, { passive: true });
    window.addEventListener("resize", alDesplazar);
    return () => {
      if (pendiente) cancelAnimationFrame(pendiente);
      window.removeEventListener("scroll", alDesplazar);
      window.removeEventListener("resize", alDesplazar);
    };
  }, [enLote.length]);
  /**
   * Cuántos canales hay bajo el filtro actual, incluidos los que aún no han
   * llegado.
   *
   * Sin esto, mientras el HTML solo trae el primer lote, la cabecera diría
   * «60» a secas: parecería que la categoría entera son sesenta canales. Con
   * una búsqueda escrita no hay forma de saberlo sin la lista completa, y ahí
   * se cuenta lo que hay —que es además cuando antes llega el resto.
   */
  const totalDelFiltro = Math.max(
    visible.length,
    search.trim() ? 0 : category === "Todas" ? totalCanales : (recuentos.get(category) ?? 0),
  );

  // Lo seleccionado, o lo que se está viendo, o el primero de la lista: la
  // columna de detalle nunca se queda vacía teniendo algo que enseñar.
  const canal = visible.find((item) => item.id === seleccionado) ?? tuned ?? visible[0] ?? null;
  const esFavorito = canal ? favorites.has(canal.id) : false;

  return (
    <div className={`screen livetv-shell ${sinHueco ? "sin-hueco" : ""}`}>
      <header className="livetv-topbar">
        <div className="livetv-heading">
          <h2>Canales</h2>
          <span>
            {totalCanales.toLocaleString("es-GT")} canales · {categories.length - 1} categorías
          </span>
        </div>

        <div className="livetv-search">
          <Search size={17} />
          <input
            data-nav="input"
            value={search}
            onChange={(evento) => onSearchChange(evento.target.value)}
            placeholder="Buscar canal"
            aria-label="Buscar canal"
          />
          {search && (
            <button
              type="button"
              data-nav="button"
              onClick={() => onSearchChange("")}
              aria-label="Borrar búsqueda"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Dos botones y no un interruptor: en un mando, un interruptor obliga
            a saber en qué estado está antes de pulsarlo, y dos botones dicen a
            dónde llevan. `aria-pressed` marca cuál está puesto. */}
        <div className="flex shrink-0 items-center rounded-full border border-white/15 p-1">
          <button
            type="button"
            data-nav="button"
            onClick={() => setModo("lista")}
            aria-pressed={modo === "lista"}
            className={`flex items-center rounded-full px-3 py-1.5 text-sm transition-colors ${
              modo === "lista" ? "bg-white/15 text-white" : "text-muted hover:text-white"
            }`}
          >
            <List size={16} aria-hidden="true" />
            <span className="ml-1.5">Lista</span>
          </button>
          <button
            type="button"
            data-nav="button"
            onClick={() => setModo("parrilla")}
            aria-pressed={modo === "parrilla"}
            className={`ml-1 flex items-center rounded-full px-3 py-1.5 text-sm transition-colors ${
              modo === "parrilla" ? "bg-white/15 text-white" : "text-muted hover:text-white"
            }`}
          >
            <CalendarClock size={16} aria-hidden="true" />
            <span className="ml-1.5">Parrilla</span>
          </button>
        </div>
      </header>

      <div className="livetv-columns">
        <nav className="livetv-cats" aria-label="Categorías de canales">
          {categories.map((nombre) => (
            <button
              type="button"
              data-nav="button"
              key={nombre}
              className={category === nombre ? "is-active" : ""}
              title={nombre}
              onClick={() => {
                onCategoryChange(nombre);
                setSeleccionado(null);
              }}
            >
              <span>{nombre}</span>
              <em>{(nombre === "Todas" ? totalCanales : (recuentos.get(nombre) ?? 0)).toLocaleString("es-GT")}</em>
            </button>
          ))}
        </nav>

        {modo === "parrilla" ? (
          /* La parrilla ocupa el sitio de la lista Y del panel de detalle:
             una rejilla de tiempo en una columna estrecha no se lee. Las
             categorías se quedan, que es el filtro que sí sigue teniendo
             sentido aquí. Se sintoniza desde la propia parrilla. */
          <main className="livetv-list" aria-label={`Parrilla de ${category}`}>
            <ParrillaEpg
              canales={visible}
              sintonizado={tuned}
              onSelect={sintonizar}
              ahora={instante}
            />
          </main>
        ) : (
          <>
        <main className="livetv-list" aria-label={category}>
          <div className="livetv-list-head">
            <h3>{category}</h3>
            <span>
              {/* Cuenta el LOTE, no la ventana. Lo que le importa a quien mira
                  es cuántos canales hay disponibles para recorrer, no cuántas
                  filas están montadas ahora mismo en el DOM — eso es un
                  detalle de implementación que cambia con el desplazamiento. */}
              {enLote.length < totalDelFiltro
                ? `${enLote.length} de ${totalDelFiltro.toLocaleString("es-GT")}`
                : totalDelFiltro.toLocaleString("es-GT")}
            </span>
          </div>

          {visible.length === 0 ? (
            <div className="livetv-list-empty">
              <Search size={28} />
              <p>
                Ningún canal coincide con {search.trim() ? `«${search.trim()}»` : "esta categoría"}.
              </p>
              {search.trim() && (
                <button
                  type="button"
                  data-nav="button"
                  className="secondary"
                  onClick={() => onSearchChange("")}
                >
                  Borrar búsqueda
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Los huecos ocupan el sitio de las filas que no se montan.
                  Sin ellos la barra de desplazamiento mediría solo lo pintado
                  y daría tirones al bajar. */}
              {ventana.huecoArriba > 0 && (
                <div style={{ height: ventana.huecoArriba }} aria-hidden="true" />
              )}
              <div className="livetv-rows" ref={contenedorFilas}>
                {filas.map((item) => (
                  <ChannelRow
                    key={item.id}
                    channel={item}
                    favorite={favorites.has(item.id)}
                    caido={idsCaidos.has(item.id)}
                    selected={canal?.id === item.id}
                    onFocus={enfocarFila}
                    onPlay={sintonizar}
                    onToggleFavorite={alternarFavorito}
                  />
                ))}
              </div>
              {ventana.huecoAbajo > 0 && (
                <div style={{ height: ventana.huecoAbajo }} aria-hidden="true" />
              )}
              <div ref={centinela} aria-hidden="true" />
            </>
          )}
        </main>

        <PanelCanal
          canal={canal}
          esFavorito={esFavorito}
          onTune={onTune}
          onToggleFavorite={onToggleFavorite}
        />
          </>
        )}
      </div>
    </div>
  );
}
