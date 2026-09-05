"use client";

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
  categories: string[];
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
  category: string;
  search: string;
  settings: PlaybackSettings;
  m3uSource: string;
  onCategoryChange: (categoria: string) => void;
  onSearchChange: (texto: string) => void;
  onSelect: (canal: Channel) => void;
  onTune: (canal: Channel) => void;
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
  return <div className={PANTALLA} aria-hidden="true" />;
}

export function VistaActiva(props: VistaActivaProps) {
  const router = useRouter();
  const { view } = props;

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
          categories={props.categories}
          category={props.category}
          search={props.search}
          onCategoryChange={props.onCategoryChange}
          onSearchChange={props.onSearchChange}
          onSelect={props.onSelect}
          onTune={props.onTune}
          onToggleFavorite={props.favorites.toggle}
        />
      );

    case "buscar":
      return (
        <BuscarView
          // Sin nada escrito se ofrecen los primeros canales como sugerencia,
          // para que la pantalla no arranque vacía.
          results={props.search ? props.visible : props.channels.slice(0, 24)}
          search={props.search}
          onSearchChange={props.onSearchChange}
          onTune={props.onTune}
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
