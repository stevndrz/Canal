"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Channel, PlaybackSettings } from "@/lib/types";
import type { CatalogSection } from "@/lib/catalog/types";
import { channelToCard, catalogToCard, type CardItem } from "@/lib/media-item";
import { groupByCategory } from "@/lib/channels";
import { MediaRail } from "@/components/media/media-rail";
import { LiveCardSkeleton } from "@/components/live-card";

/**
 * El reproductor solo puede existir en el navegador.
 *
 * `hls.js` y `mpegts.js` tocan `self` al evaluarse, y en el servidor eso es un
 * `ReferenceError` que tumba la página entera con un 500. Ya pasó una vez en
 * producción con este mismo diseño.
 */
const LiveCard = dynamic(() => import("@/components/live-card").then((m) => m.LiveCard), {
  ssr: false,
  loading: () => <LiveCardSkeleton />,
});

interface HomeViewProps {
  channels: Channel[];
  tuned: Channel | null;
  favorites: Set<number>;
  recents: Channel[];
  catalog: CatalogSection[];
  settings: PlaybackSettings;
  /** Sintonizar sin salir de Inicio: cambia el canal de la tarjeta. */
  onSelect: (channel: Channel) => void;
  /** Pasar a pantalla completa con ese canal. */
  onExpand: (channel: Channel) => void;
  onNext: () => void;
  onOpenTitle: (mediaType: string, id: string) => void;
}

/** Cuántas categorías de canales se ofrecen antes de mandar a Canales. */
const MAX_GRUPOS = 6;
/** Un riel más largo que esto no lo recorre nadie; para eso está Canales. */
const MAX_POR_RIEL = 20;

/**
 * Inicio: la señal en directo arriba, y todo lo demás debajo.
 *
 * El orden es la decisión de producto de esta pantalla. Antes abría con una
 * cabecera de película a pantalla completa, que es lo que hace ARVIO porque su
 * app va de películas. CanalCasa va de televisión en vivo: al entrar tiene que
 * haber señal, y el catálogo es una sección más, no la portada.
 *
 * La pantalla completa deja de ser la puerta de entrada y pasa a ser una
 * decisión: doble clic en la tarjeta, Enter con el mando, o el botón.
 */
export function HomeView({
  channels,
  tuned,
  favorites,
  recents,
  catalog,
  settings,
  onSelect,
  onExpand,
  onNext,
  onOpenTitle,
}: HomeViewProps) {
  const favoriteChannels = useMemo(
    () => channels.filter((channel) => favorites.has(channel.id)),
    [channels, favorites],
  );

  const grupos = useMemo(() => groupByCategory(channels).slice(0, MAX_GRUPOS), [channels]);

  const abrirCanal = (card: CardItem) => {
    const canal = channels.find((channel) => `canal-${channel.id}` === card.key);
    // Una tarjeta de canal cambia lo que suena en la tarjeta de arriba; no
    // salta a pantalla completa. Ir a pantalla completa se pide aparte.
    if (canal) onSelect(canal);
  };

  const abrirFicha = (card: CardItem) => {
    const [mediaType, ...resto] = card.key.split("-");
    onOpenTitle(mediaType, resto.join("-"));
  };

  const tunedKey = tuned ? `canal-${tuned.id}` : null;

  return (
    /* `.screen` a secas, sin `has-section-heading`: esa clase pone el hueco
       superior a cero porque asume que la primera cosa de la pantalla es un
       encabezado. Aquí lo primero es la tarjeta en directo, y sin hueco su
       cabecera se metía debajo de la barra de navegación. */
    <div className="screen">
      {tuned && (
        <LiveCard
          channel={tuned}
          settings={settings}
          onExpand={onExpand}
          onNext={onNext}
        />
      )}

      <MediaRail
        title="Seguir viendo"
        items={recents.map((channel) => channelToCard(channel))}
        onOpen={abrirCanal}
        activeKey={tunedKey}
      />

      <MediaRail
        title="Tus favoritos"
        items={favoriteChannels.map((channel) => channelToCard(channel))}
        onOpen={abrirCanal}
        count={favoriteChannels.length > 0 ? `${favoriteChannels.length}` : undefined}
        activeKey={tunedKey}
      />

      {grupos.map(({ category, items }) => (
        <MediaRail
          key={category}
          title={category}
          items={items.slice(0, MAX_POR_RIEL).map((channel) => channelToCard(channel))}
          onOpen={abrirCanal}
          count={`${items.length}`}
          activeKey={tunedKey}
        />
      ))}

      {catalog.length > 0 && (
        <>
          <section className="section-heading library-heading">
            <div className="library-title-block">
              <p className="eyebrow">Además de la televisión en vivo</p>
              <h2>Películas y series</h2>
            </div>
          </section>

          {catalog.map((section) => (
            <MediaRail
              key={section.title}
              title={section.title}
              items={section.items.map(catalogToCard)}
              onOpen={abrirFicha}
              posterMode
            />
          ))}
        </>
      )}
    </div>
  );
}
