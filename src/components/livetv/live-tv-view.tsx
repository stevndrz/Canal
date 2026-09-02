"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { CalendarClock, List, Search, X } from "lucide-react";
import type { Channel } from "@/lib/types";
import { QUE_SE_PINTA } from "@/lib/canales-empaquetados";
import { channelToCard, type CardItem } from "@/lib/media-item";
import {
  calcularVentana,
  ventanaCambio,
  type Ventana,
} from "@/lib/ventana-lista";
import { MediaRail } from "@/components/media/media-rail";
import { ChannelRow } from "./channel-row";
import { ParrillaEpg } from "./parrilla-epg";
import { PanelCanal } from "./panel-canal";
import { useInstante } from "@/hooks/use-reloj";

const LOTE = QUE_SE_PINTA.lote;

const HUECO_FILA = 4;

const VENTANA_INICIAL: Ventana = { desde: 0, hasta: LOTE, huecoArriba: 0, huecoAbajo: 0 };

interface LiveTvViewProps {
  recuentos: Map<string, number>;
  totalCanales: number;
  deLaCasa: Channel[];
  idsCaidos: Set<number>;
  visible: Channel[];
  tuned: Channel | null;
  favorites: Set<number>;
  /** Los vistos hace poco, ya resueltos a `Channel`. Ver `dashboard.tsx`. */
  recents: Channel[];
  categories: string[];
  category: string;
  search: string;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onSelect: (channel: Channel) => void;
  onTune: (channel: Channel) => void;
  onToggleFavorite: (id: number) => void;
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
  recents,
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
  const sintonizar = useCallback(
    (canal: Channel) => {
      onSelect(canal);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onSelect],
  );

  /**
   * Las mismas tarjetas que ya pinta «Seguir viendo» en Inicio: no hacía falta
   * un componente nuevo, solo traer el riel aquí. Calculado una vez y no en el
   * JSX porque `channelToCard` devuelve un objeto nuevo cada vez, y `MediaRail`
   * compara por identidad para no repintar.
   */
  const tarjetasRecientes = useMemo(() => recents.map((canal) => channelToCard(canal)), [recents]);
  const abrirReciente = useCallback(
    (card: CardItem) => {
      const canal = recents.find((item) => `canal-${item.id}` === card.key);
      if (canal) sintonizar(canal);
    },
    [recents, sintonizar],
  );

  const [modo, setModo] = useState<"lista" | "parrilla">("lista");
  const instante = useInstante();

  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const enfocarFila = useCallback((canal: Channel) => setSeleccionado(canal.id), []);
  const alternarFavorito = useCallback(
    (canal: Channel) => onToggleFavorite(canal.id),
    [onToggleFavorite],
  );
  const [pintadas, setPintadas] = useState(LOTE);
  const centinela = useRef<HTMLDivElement | null>(null);
  const contenedorFilas = useRef<HTMLDivElement | null>(null);
  const [ventana, setVentana] = useState<Ventana>(VENTANA_INICIAL);

  const [filtroPrevio, setFiltroPrevio] = useState(`${category}|${search}`);
  const filtroActual = `${category}|${search}`;
  if (filtroPrevio !== filtroActual) {
    setFiltroPrevio(filtroActual);
    setPintadas(LOTE);
  }

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

  const totalDelFiltro = Math.max(
    visible.length,
    search.trim() ? 0 : category === "Todas" ? totalCanales : (recuentos.get(category) ?? 0),
  );

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

      {/* Historial, no oferta: mismo riel compacto que «Seguir viendo» en
          Inicio. Se recorta solo si no hay nada que contar (ver `MediaRail`). */}
      <MediaRail
        compacto
        title="Vistos recientemente"
        items={tarjetasRecientes}
        onOpen={abrirReciente}
        activeKey={tuned ? `canal-${tuned.id}` : null}
      />

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
