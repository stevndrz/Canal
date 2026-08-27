"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Play, Search, Star, Tv, X } from "lucide-react";
import type { Channel } from "@/lib/types";
import { channelMark } from "@/lib/channels";
import { describirCanal } from "@/lib/describir-canal";
import { hora, porcentajeDelPrograma } from "@/lib/guia-epg";
import { QUE_SE_PINTA } from "@/lib/canales-empaquetados";
import {
  calcularVentana,
  ventanaCambio,
  type Ventana,
} from "@/lib/ventana-lista";
import { ChannelRow } from "./channel-row";

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
 *   - Fuera el conmutador Lista/Guía y la parrilla EPG: decidido dejarlo para
 *     una tanda posterior.
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
   * Elegir un canal cambia la señal de arriba y sube a verla.
   *
   * Antes saltaba a pantalla completa, y eso convertía explorar la lista en un
   * viaje de ida: para probar otro canal había que salir del reproductor,
   * volver a Canales y buscar dónde estabas. Ahora la emisión cambia en la
   * tarjeta que ya está en esta misma pantalla, y la lista se queda donde
   * estaba. Ir a pantalla completa sigue siendo una decisión aparte.
   */
  const sintonizar = useCallback(
    (canal: Channel) => {
      onSelect(canal);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onSelect],
  );

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
   * El lote sigue mandando cuántas filas EXISTEN; la ventana, cuántas se
   * montan de verdad.
   *
   * Son dos cosas distintas y las dos hacen falta. El lote evita pedirle a la
   * tele que calcule 7.822 posiciones de golpe al abrir la pantalla. La
   * ventana evita que, tras bajar un rato, esas 7.822 filas se queden montadas
   * para siempre: eran ~141.000 nodos y 15.650 elementos `[data-nav]`, y
   * `use-spatial-nav` los recorre **en cada pulsación de flecha del mando**
   * llamando a `getBoundingClientRect()`.
   */
  /**
   * Los canales de la casa, arriba del todo.
   *
   * Solo en «Todas» y sin búsqueda escrita: si alguien ha pedido Deportes o ha
   * escrito «bbc», subirle el Canal 3 es contestar otra pregunta. Y se quitan
   * de su sitio original para que no salgan dos veces.
   *
   * **Manda sobre el apartado de los canales caídos, y es a propósito.** Si
   * Guatevisión no responde hoy, sigue siendo el canal que siempre se ve: lo
   * último que quiere nadie es tener que buscarlo entre 7.822 para comprobar
   * si ya volvió. Se queda en su sitio con su marca de «sin señal», que es
   * información suficiente. Los demás sí bajan al final.
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

  const canal = visible.find((item) => item.id === seleccionado) ?? tuned ?? visible[0] ?? null;
  const progreso = canal
    ? // eslint-disable-next-line react-hooks/purity -- el reloj decide cuánto lleva emitido
      porcentajeDelPrograma(canal.currentStart, canal.currentEnd, Date.now())
    : null;
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

        <aside className="livetv-detail" aria-label="Detalle del canal">
          {canal ? (
            <>
              <div className="livetv-detail-art">
                {canal.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={canal.logoUrl} alt="" loading="lazy" />
                ) : (
                  <b className="livetv-row-mark">{channelMark(canal)}</b>
                )}
              </div>

              <p className="livetv-detail-group">
                {canal.number} · {canal.category}
              </p>
              <h2>{canal.name}</h2>

              {canal.currentProgram ? (
                <div className="livetv-program">
                  <div className="livetv-program-head">
                    <span>AHORA</span>
                    {canal.currentStart && (
                      <em>
                        {hora(canal.currentStart)} – {hora(canal.currentEnd)}
                      </em>
                    )}
                  </div>
                  <strong>{canal.currentProgram}</strong>
                  {progreso !== null && (
                    <span className="livetv-progress">
                      <span style={{ width: `${progreso}%` }} />
                    </span>
                  )}
                </div>
              ) : (
                /* Sin guía, el panel cuenta lo que sí se sabe del canal en vez
                   de quedarse en «no hay datos» y dejar la columna vacía. Todo
                   se deriva en el cliente: cero peticiones, cero bytes de más
                   en los 7.822 canales que viajan en el HTML. */
                <AcercaDelCanal canal={canal} />
              )}

              {canal.nextProgram && (
                <div className="livetv-program is-next">
                  <div className="livetv-program-head">
                    <span>DESPUÉS</span>
                    {canal.nextStart && <em>{hora(canal.nextStart)}</em>}
                  </div>
                  <strong>{canal.nextProgram}</strong>
                </div>
              )}

              <div className="livetv-detail-actions">
                <button type="button" data-nav="button" className="primary" onClick={() => onTune(canal)}>
                  <Play size={17} fill="currentColor" /> Ver ahora
                </button>
                <button
                  type="button"
                  data-nav="button"
                  className={esFavorito ? "secondary is-active" : "secondary"}
                  aria-pressed={esFavorito}
                  onClick={() => onToggleFavorite(canal.id)}
                >
                  <Star size={17} fill={esFavorito ? "currentColor" : "none"} />
                  {esFavorito ? "En favoritos" : "Favorito"}
                </button>
              </div>
            </>
          ) : (
            <div className="livetv-detail-empty-state">
              <Tv size={44} />
              <p>Elige un canal para ver su información.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/**
 * Qué es este canal, cuando no hay guía que contar.
 *
 * Es lo que ocupa la columna de detalle en la mayoría de los casos: casi
 * ninguna lista M3U pública trae EPG, así que antes ahí solo se leía «Este
 * canal no tiene guía de programación» y debajo, nada.
 */
function AcercaDelCanal({ canal }: { canal: Channel }) {
  const { descripcion, datos } = describirCanal(canal);

  return (
    <div className="livetv-acerca">
      <p className="livetv-acerca-texto">{descripcion}</p>

      <dl className="livetv-acerca-datos">
        {datos.map(({ termino, valor }) => (
          <div key={termino}>
            <dt>{termino}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>

      <p className="livetv-acerca-nota">Este canal no publica guía de programación.</p>
    </div>
  );
}
