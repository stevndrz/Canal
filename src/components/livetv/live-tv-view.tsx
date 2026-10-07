"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import type { Channel } from "@/lib/types";
import { QUE_SE_PINTA } from "@/lib/canales-empaquetados";
import { publicConfig } from "@/lib/config";
import { esRegion, type Region } from "@/lib/origenes";
import { TEMAS_CON_CHIP, temaDeClave } from "@/lib/temas";
import {
  filasDeCanales,
  indexarCanales,
  normalizarCasa,
  type Filtro,
} from "@/lib/secciones-canales";
import { esTeclaAtras } from "@/hooks/use-spatial-nav";
import { useInstante } from "@/hooks/use-reloj";
import { BarraFiltros } from "./barra-filtros";
import { ListaSecciones, type PeticionDeFoco } from "./lista-secciones";
import { ParrillaEpg } from "./parrilla-epg";
import { PanelCanal } from "./panel-canal";

interface LiveTvViewProps {
  /**
   * Cuántos hay de cada cosa en la lista COMPLETA, aunque `visible` sea aún el
   * recorte del HTML. Además de las categorías trae las claves por región y
   * tema (`claveDeRecuento`). Ver `recuentosDe`.
   */
  recuentos: Map<string, number>;
  totalCanales: number;
  deLaCasa: Channel[];
  idsCaidos: Set<number>;
  /** Todos los canales, con los caídos al final. Ver `dashboard.tsx`. */
  visible: Channel[];
  tuned: Channel | null;
  favorites: Set<number>;
  /** Los vistos hace poco, ya resueltos a `Channel`. */
  recents: Channel[];
  /** Ya no se usan: el tema y la búsqueda son de esta pantalla. Ver abajo. */
  categories?: string[];
  category?: string;
  /**
   * La búsqueda COMPARTIDA del shell (la de Buscar). Esta pantalla ya no la
   * escribe; si llega con algo, `visible` viene filtrada por ella y se avisa.
   */
  search: string;
  onCategoryChange?: (category: string) => void;
  onSearchChange: (search: string) => void;
  onSelect: (channel: Channel) => void;
  onTune: (channel: Channel) => void;
  onToggleFavorite: (id: number) => void;
  sinHueco?: boolean;
}

/** Cuánto tiene que traer guía para que la parrilla merezca la pena. */
const MINIMO_CON_GUIA = 0.25;

/** En la tele caben menos filas por pantalla: seis por sección en vez de ocho. */
const POR_SECCION_TV = 6;

/**
 * Canales: lo mío, lo de aquí, lo que entiendo y el mundo, por secciones.
 *
 * Esta vista es un orquestador fino: el reparto en secciones vive en
 * `lib/secciones-canales.ts` (con prueba), la cabecera en `barra-filtros.tsx`
 * y la lista virtual en `lista-secciones.tsx`.
 *
 * **El tema y la búsqueda son estado de esta pantalla**, no del shell. Antes
 * la categoría elegida aquí gobernaba Buscar y el zapeo de toda la app: con
 * «Internacional» elegido, buscar «guate» en Buscar no encontraba nada y ⏭
 * desde Inicio saltaba a «1-2-3 TV». Ahora no sale de aquí.
 */
export function LiveTvView({
  recuentos,
  totalCanales,
  deLaCasa,
  idsCaidos,
  visible,
  tuned,
  favorites,
  recents,
  search,
  onSearchChange,
  onSelect,
  onTune,
  onToggleFavorite,
  sinHueco,
}: LiveTvViewProps) {
  const [filtro, setFiltro] = useState<Filtro>("todo");
  const [masAbierto, setMasAbierto] = useState(false);
  const [abierta, setAbierta] = useState<Region | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [modo, setModo] = useState<"lista" | "parrilla">("lista");
  const [enfocar, setEnfocar] = useState<PeticionDeFoco | null>(null);
  const instante = useInstante();

  /**
   * Llegar desde Inicio con una sección ya elegida («Ver los 27 ›»):
   * `?vista=canales&seccion=guatemala` o `&tema=deportes`.
   *
   * Se lee una vez y se limpia la URL. Si se quedara, la siguiente «Ver los N»
   * desde Inicio no movería nada: `dashboard.tsx` solo cambia de vista cuando
   * `?vista=` CAMBIA, y seguiría diciendo «canales».
   */
  const parametros = useSearchParams();
  const [llegada] = useState(() => ({
    seccion: parametros.get("seccion"),
    tema: parametros.get("tema"),
  }));
  useEffect(() => {
    const { seccion, tema } = llegada;
    // Una sola vez, al llegar desde «Ver los N» de Inicio: aplica la sección o
    // el tema pedidos en la URL y la limpia (ver arriba).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (seccion && esRegion(seccion)) setAbierta(seccion);
    const temaPedido = tema ? temaDeClave(tema) : null;
    if (temaPedido) setFiltro(temaPedido);
    if (parametros.has("vista") || parametros.has("seccion") || parametros.has("tema")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (seccion || temaPedido) {
      // Se viene a ver esa sección, no el vídeo de arriba.
      document.querySelector(".livetv-cabecera")?.scrollIntoView({ block: "start" });
    }
    // Solo al montar: es la llegada, no un estado que haya que seguir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Seis por sección en la tele: siete filas de 96 px caben en 1080. */
  const [porSeccion, setPorSeccion] = useState(QUE_SE_PINTA.porSeccion);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `<html>` solo se lee en el navegador
    if (document.documentElement.dataset.pantalla === "tv") setPorSeccion(POR_SECCION_TV);
  }, []);

  const casa = useMemo(() => normalizarCasa(publicConfig.canalesDeCasa), []);

  /**
   * Lo caro, una vez por lista: cada canal en su región y en su orden, y el
   * texto de búsqueda ya normalizado. Se rehace cuando llega la lista
   * completa o cambia un caído, no por cada tecla.
   */
  const indice = useMemo(() => indexarCanales(visible, casa), [visible, casa]);

  const favoritos = useMemo(
    () => visible.filter((canal) => favorites.has(canal.id)),
    [visible, favorites],
  );

  const filas = useMemo(
    () =>
      filasDeCanales({
        indice,
        filtro,
        abierta,
        busqueda,
        deLaCasa,
        favoritos,
        recientes: recents,
        caidos: idsCaidos,
        porSeccion,
        recuentos,
      }),
    [indice, filtro, abierta, busqueda, deLaCasa, favoritos, recents, idsCaidos, porSeccion, recuentos],
  );

  /** Los canales que se ven ahora, sin repetir: lo que mira la parrilla. */
  const canalesALaVista = useMemo(() => {
    const vistos = new Set<number>();
    const lista: Channel[] = [];
    for (const fila of filas) {
      if (fila.tipo !== "canal" || vistos.has(fila.canal.id)) continue;
      vistos.add(fila.canal.id);
      lista.push(fila.canal);
    }
    return lista;
  }, [filas]);

  /**
   * La parrilla solo se ofrece si hay algo que poner en ella. Con la lista por
   * defecto la guía casa con UN canal de 4.816: el conmutador llevaba a una
   * rejilla vacía presentada como el modo principal. El código sigue aquí:
   * con una `EPG_URL` de verdad, el conmutador vuelve solo.
   */
  const ofrecerParrilla = useMemo(() => {
    if (canalesALaVista.length === 0) return false;
    const conGuia = canalesALaVista.filter((canal) => canal.currentProgram).length;
    return conGuia / canalesALaVista.length >= MINIMO_CON_GUIA;
  }, [canalesALaVista]);
  const enParrilla = modo === "parrilla" && ofrecerParrilla;

  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const enfocarFila = useCallback((canal: Channel) => setSeleccionado(canal.id), []);
  const alternarFavorito = useCallback(
    (canal: Channel) => onToggleFavorite(canal.id),
    [onToggleFavorite],
  );

  /**
   * Elegir un canal lo pone en el reproductor, sin pantalla completa
   * (decisión 5). Con puntero se sube al principio para verlo, como siempre.
   * Con mando NO: la fila enfocada se desmontaría con la ventana virtual y el
   * foco caería en `<body>`, y la tele se quedaría sin desde dónde moverse.
   */
  const sintonizar = useCallback(
    (canal: Channel) => {
      onSelect(canal);
      if (document.documentElement.dataset.input !== "dpad") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    },
    [onSelect],
  );

  const cambiarFiltro = useCallback((siguiente: Filtro) => {
    setFiltro(siguiente);
    setSeleccionado(null);
  }, []);

  const alternarMas = useCallback(() => {
    // Al plegar «Más» con uno de sus temas elegido, se vuelve a Todo: un
    // filtro puesto sin su chip a la vista es un filtro invisible.
    if (masAbierto && !TEMAS_VISIBLES.has(filtro)) setFiltro("todo");
    setMasAbierto(!masAbierto);
  }, [masAbierto, filtro]);

  const abrir = useCallback((region: Region) => {
    setAbierta(region);
    setEnfocar({ clave: `volver:${region}`, vez: Date.now() });
  }, []);

  const volver = useCallback(() => {
    if (abierta) setEnfocar({ clave: `ver:${abierta}`, vez: Date.now() });
    setAbierta(null);
  }, [abierta]);

  /**
   * Atrás con una sección abierta la cierra, antes de que el shell se lleve la
   * pantalla entera a Inicio. En fase de captura y con `stopPropagation`,
   * como la guía de `fullscreen-player.tsx`: el `keydown` de
   * `use-spatial-nav` escucha en la ventana y, en burbuja, llegaría antes.
   */
  useEffect(() => {
    if (!abierta) return undefined;
    const alPulsar = (evento: KeyboardEvent) => {
      if (!esTeclaAtras(evento)) return;
      const objetivo = evento.target as HTMLElement | null;
      if (objetivo?.tagName === "INPUT" && evento.key !== "Escape") return;
      evento.preventDefault();
      evento.stopPropagation();
      volver();
    };
    window.addEventListener("keydown", alPulsar, true);
    return () => window.removeEventListener("keydown", alPulsar, true);
  }, [abierta, volver]);

  /**
   * Volver «Plegada» → la fila de «Ver los N» o de la sección plegada. Si la
   * sección cerrada era una plegada, su fila se llama `plegada:` y no `ver:`.
   */
  const peticion = useMemo<PeticionDeFoco | null>(() => {
    if (!enfocar) return null;
    if (!enfocar.clave.startsWith("ver:")) return enfocar;
    const region = enfocar.clave.slice(4);
    const existe = filas.some((fila) => fila.clave === enfocar.clave);
    return existe ? enfocar : { clave: `plegada:${region}`, vez: enfocar.vez };
  }, [enfocar, filas]);

  /** En la tele, la lupa lleva a Buscar: allí hay un teclado que se maneja con el mando. */
  const buscarEnTv = useCallback(() => {
    window.history.replaceState(null, "", `${window.location.pathname}?vista=buscar`);
  }, []);

  const canal =
    (seleccionado !== null ? visible.find((item) => item.id === seleccionado) : null) ??
    tuned ??
    visible[0] ??
    null;

  return (
    <div className={`screen livetv-shell ${sinHueco ? "sin-hueco" : ""}`}>
      <BarraFiltros
        total={Math.max(totalCanales, visible.length)}
        filtro={filtro}
        onFiltro={cambiarFiltro}
        masAbierto={masAbierto}
        onMas={alternarMas}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        onBuscarEnTv={buscarEnTv}
        ofrecerParrilla={ofrecerParrilla}
        modo={enParrilla ? "parrilla" : "lista"}
        onModo={setModo}
      />

      {/* La búsqueda del shell es la de Buscar: si llega con algo, la lista
          viene recortada por ella. Se dice y se puede quitar, en vez de
          enseñar una lista corta sin explicación. */}
      {search.trim() && (
        <p className="livetv-aviso-busqueda" role="status">
          <span>Mostrando solo lo que coincide con «{search.trim()}», de Buscar.</span>
          <button type="button" data-nav="button" onClick={() => onSearchChange("")}>
            <X aria-hidden="true" />
            Quitar
          </button>
        </p>
      )}

      <div className="livetv-columns">
        <main className="livetv-list" aria-label="Lista de canales">
          {enParrilla ? (
            <ParrillaEpg
              canales={canalesALaVista}
              sintonizado={tuned}
              onSelect={sintonizar}
              ahora={instante}
            />
          ) : (
            <ListaSecciones
              filas={filas}
              favoritos={favorites}
              caidos={idsCaidos}
              sonandoId={tuned?.id ?? null}
              enfocar={peticion}
              onFocusCanal={enfocarFila}
              onPlay={sintonizar}
              onToggleFavorite={alternarFavorito}
              onAbrir={abrir}
              onVolver={volver}
            />
          )}
        </main>

        <PanelCanal
          canal={canal}
          sonando={canal !== null && canal.id === tuned?.id}
          esFavorito={canal ? favorites.has(canal.id) : false}
          onSelect={sintonizar}
          onTune={onTune}
          onToggleFavorite={onToggleFavorite}
        />
      </div>
    </div>
  );
}

/** Los filtros que tienen chip propio siempre a la vista. */
const TEMAS_VISIBLES = new Set<Filtro>(["mios", "todo", ...TEMAS_CON_CHIP]);
