"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { HomeView } from "@/components/views/home-view";
import type { FilaDeTarjetas } from "@/components/catalog/catalog-row";
import type { Channel, PlaybackSettings, ViewId } from "@/lib/types";

/**
 * Las vistas que NO se ven al abrir, bajo demanda.
 *
 * Antes venían las cinco por `import` estático y el bundle inicial las pagaba
 * todas —parrilla EPG, guía, formularios— aunque solo se pintara Inicio. Con
 * `dynamic()` cada una viaja en su chunk y se descarga al entrar a su pestaña,
 * una sola vez. `HomeView` se queda estático a propósito: es la primera
 * pantalla y diferirla sería un parpadeo en cada arranque a cambio de nada.
 */
const LiveTvView = dynamic(
  () => import("@/components/livetv/live-tv-view").then((m) => m.LiveTvView),
  { loading: () => <VistaCargando /> },
);
const BuscarView = dynamic(
  () => import("@/components/views/buscar-view").then((m) => m.BuscarView),
  { loading: () => <VistaCargando /> },
);
const FuenteView = dynamic(
  () => import("@/components/views/fuente-view").then((m) => m.FuenteView),
  { loading: () => <VistaCargando /> },
);
const AjustesView = dynamic(
  () => import("@/components/views/ajustes-view").then((m) => m.AjustesView),
  { loading: () => <VistaCargando /> },
);

/**
 * Qué pantalla se pinta.
 *
 * Estaba dentro de `dashboard.tsx` como ocho `{view === "x" && …}` seguidos.
 * Funcionaba, pero tenía dos problemas que se notaban al tocarlo:
 *
 *  1. **No era exhaustivo.** Añadir una vista nueva y olvidar su condición
 *     dejaba una pantalla en blanco sin ningún error. Con un `switch` sobre
 *     `ViewId`, TypeScript avisa en cuanto falta un caso.
 *  2. Convertía el `return` del componente en cien líneas de JSX anidado,
 *     mezclando el armazón —barra, reproductor, pantalla completa— con el
 *     contenido de cada sección.
 *
 * La lista de props es larga, y eso es honesto: `Dashboard` es de verdad quien
 * posee este estado. Lo que se ha separado es **quién decide qué se pinta**
 * de **quién guarda los datos**, no una cosa de la otra.
 */
export interface VistaActivaProps {
  view: ViewId;
  channels: Channel[];
  visible: Channel[];
  tuned: Channel | null;
  favorites: { ids: Set<number>; toggle: (id: number) => void; clear: () => void };
  recentChannels: Channel[];
  catalog: FilaDeTarjetas[];
  /**
   * Cuántos canales tiene cada categoría en la lista COMPLETA, y cuántos hay en
   * total. No se cuentan sobre `channels` porque `channels` puede ser todavía
   * el recorte que vino en el HTML. Ver `dashboard.tsx`.
   */
  recuentos: Map<string, number>;
  totalCanales: number;
  /** Los canales que se ven de cajón. Ver `publicConfig.canalesDeCasa`. */
  deLaCasa: Channel[];
  /** Los que han dejado de responder en este aparato. Ver `canales-caidos.ts`. */
  idsCaidos: Set<number>;
  /**
   * Lo escrito en Buscar. Solo de Buscar: Canales lleva su propia búsqueda y
   * su tema, y ninguna de las dos se cuela en la otra ni en el zapeo.
   */
  busqueda: string;
  settings: PlaybackSettings;
  m3uSource: string;
  onBusquedaChange: (texto: string) => void;
  onSelect: (canal: Channel) => void;
  onTune: (canal: Channel) => void;
  /** Sintonizar desde Buscar: los resultados pasan a ser el contexto de zapeo. */
  onTuneDesdeBusqueda: (canal: Channel, resultados: Channel[], titulo: string) => void;
  onPatchSettings: (patch: Partial<PlaybackSettings>) => void;
}

/** El armazón que envuelve a las vistas que aún no traen el suyo. */
const PANTALLA = "screen tv-safe";

/**
 * Hueco mientras baja el chunk de una vista: el mismo armazón vacío, para que
 * el cambio de pestaña no pegue un salto de layout. Solo se ve la primera vez
 * que se entra a cada pestaña; después el chunk ya está en caché.
 */
function VistaCargando() {
  // `data-vista-cargando`: el shell espera a que desaparezca para llevar el
  // foco del mando a la entrada de la vista (ver `dashboard.tsx`).
  return <div className={PANTALLA} aria-hidden="true" data-vista-cargando="" />;
}

/** Canales ya no escribe en la búsqueda del shell: lo que pida, se ignora. */
function ignorar() {}

/**
 * Lo que Buscar ofrece antes de escribir nada: los de la casa, los vistos
 * hace poco y, para completar, los primeros de la lista. Doce: una fila y
 * media en la tele, sin enterrar el teclado en destinos.
 */
function sugeridos(
  deLaCasa: Channel[],
  recentChannels: Channel[],
  channels: Channel[],
): Channel[] {
  const vistos = new Set<number>();
  const lista: Channel[] = [];
  for (const canal of [...deLaCasa, ...recentChannels, ...channels.slice(0, 24)]) {
    if (vistos.has(canal.id)) continue;
    vistos.add(canal.id);
    lista.push(canal);
    if (lista.length === 12) break;
  }
  return lista;
}

export function VistaActiva(props: VistaActivaProps) {
  const router = useRouter();
  const { view } = props;
  /**
   * Memorizados: el shell se repinta con cada dígito marcado o cambio de
   * canal, y un array nuevo cada vez rehacía las doce fichas de Buscar (el
   * `memo` de `MediaCard` no acertaba nunca).
   */
  const { deLaCasa, recentChannels, channels } = props;
  const sugeridosDeBuscar = useMemo(
    () => sugeridos(deLaCasa, recentChannels, channels),
    [deLaCasa, recentChannels, channels],
  );

  switch (view) {
    case "home":
      return (
        <HomeView
          sinHueco
          channels={props.channels}
          tuned={props.tuned}
          favorites={props.favorites.ids}
          recents={props.recentChannels}
          deLaCasa={props.deLaCasa}
          catalog={props.catalog}
          onSelect={props.onSelect}
          onOpenTitle={(mediaType, id) => router.push(`/peliculas/${mediaType}/${id}`)}
        />
      );

    case "canales":
      return (
        <LiveTvView
          sinHueco
          recuentos={props.recuentos}
          totalCanales={props.totalCanales}
          deLaCasa={props.deLaCasa}
          idsCaidos={props.idsCaidos}
          visible={props.visible}
          tuned={props.tuned}
          favorites={props.favorites.ids}
          recents={props.recentChannels}
          // La búsqueda del shell ya no existe para Canales: la suya va dentro.
          search=""
          onSearchChange={ignorar}
          onSelect={props.onSelect}
          onTune={props.onTune}
          onToggleFavorite={props.favorites.toggle}
        />
      );

    case "buscar":
      return (
        <BuscarView
          canales={props.visible}
          sugeridos={sugeridosDeBuscar}
          tunedId={props.tuned?.id ?? null}
          search={props.busqueda}
          onSearchChange={props.onBusquedaChange}
          onTune={props.onTuneDesdeBusqueda}
        />
      );

    case "fuente":
      return <FuenteView />;

    case "ajustes":
      return (
        <div className={PANTALLA}>
          <AjustesView
            settings={props.settings}
            onChange={props.onPatchSettings}
            channelCount={props.totalCanales}
            favoriteCount={props.favorites.ids.size}
            onClearFavorites={props.favorites.clear}
            onRefresh={() => router.refresh()}
            m3uSource={props.m3uSource}
          />
        </div>
      );

    // La pantalla completa no es una vista del contenido: la pinta el shell
    // por encima de todo, con su propio reproductor.
    case "player":
      return null;
  }
}
