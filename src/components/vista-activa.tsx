"use client";

import { useRouter } from "next/navigation";
import { AjustesView } from "@/components/views/ajustes-view";
import { BuscarView } from "@/components/views/buscar-view";
import { CategoriasView } from "@/components/views/categorias-view";
import { FavoritosView } from "@/components/views/favoritos-view";
import { FuenteView } from "@/components/views/fuente-view";
import { HomeView } from "@/components/views/home-view";
import { LiveTvView } from "@/components/livetv/live-tv-view";
import type { CatalogSection } from "@/lib/catalog/types";
import type { Channel, PlaybackSettings, ViewId } from "@/lib/types";

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
  catalog: CatalogSection[];
  categories: string[];
  category: string;
  search: string;
  settings: PlaybackSettings;
  m3uSource: string;
  onCategoryChange: (categoria: string) => void;
  onSearchChange: (texto: string) => void;
  onSelect: (canal: Channel) => void;
  onTune: (canal: Channel) => void;
  onPickCategory: (categoria: string) => void;
  onPatchSettings: (patch: Partial<PlaybackSettings>) => void;
}

/** El armazón que envuelve a las vistas que aún no traen el suyo. */
const PANTALLA = "screen tv-safe";

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
          catalog={props.catalog}
          onSelect={props.onSelect}
          onOpenTitle={(mediaType, id) => router.push(`/peliculas/${mediaType}/${id}`)}
        />
      );

    case "canales":
      return (
        <LiveTvView
          sinHueco
          channels={props.channels}
          visible={props.visible}
          tuned={props.tuned}
          favorites={props.favorites.ids}
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

    case "favoritos":
      return (
        <FavoritosView
          channels={props.channels}
          favorites={props.favorites.ids}
          tunedId={props.tuned?.id ?? null}
          onTune={props.onTune}
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

    case "categorias":
      return <CategoriasView channels={props.channels} onPick={props.onPickCategory} />;

    case "ajustes":
      return (
        <div className={PANTALLA}>
          <AjustesView
            settings={props.settings}
            onChange={props.onPatchSettings}
            channelCount={props.channels.length}
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
