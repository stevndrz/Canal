"use client";

import { useMemo, useState } from "react";
import type { Channel } from "@/lib/types";
import type { CatalogSection } from "@/lib/catalog/types";
import { channelToCard, catalogToCard, type CardItem } from "@/lib/media-item";
import { groupByCategory } from "@/lib/channels";
import { Hero } from "@/components/media/hero";
import { MediaRail } from "@/components/media/media-rail";

interface HomeViewProps {
  channels: Channel[];
  tuned: Channel | null;
  favorites: Set<number>;
  recents: Channel[];
  catalog: CatalogSection[];
  onTune: (channel: Channel) => void;
  onOpenTitle: (mediaType: string, id: string) => void;
}

/** Cuántas categorías de canales se ofrecen antes de mandar a Canales. */
const MAX_GRUPOS = 6;
/** Un riel más largo que esto no lo recorre nadie; para eso está Canales. */
const MAX_POR_RIEL = 20;

/**
 * Inicio: hero + rieles, el patrón lean-back de ARVIO.
 *
 * El hero rota sobre el catálogo y no sobre los canales por una razón de
 * material: una ficha de TMDB trae un fondo apaisado pensado para ocupar la
 * pantalla, mientras que un canal solo tiene un logo cuadrado que al estirarse
 * queda borroso. Los canales mandan en los rieles, que es donde su logo se ve
 * bien; el catálogo manda arriba, que es donde hace falta una imagen grande.
 */
export function HomeView({
  channels,
  tuned,
  favorites,
  recents,
  catalog,
  onTune,
  onOpenTitle,
}: HomeViewProps) {
  const [pinned, setPinned] = useState<CardItem | null>(null);

  const favoriteChannels = useMemo(
    () => channels.filter((channel) => favorites.has(channel.id)),
    [channels, favorites],
  );

  const grupos = useMemo(() => groupByCategory(channels).slice(0, MAX_GRUPOS), [channels]);

  // Solo entran al hero las fichas con fondo apaisado de verdad. Sin este
  // filtro, una ficha sin backdrop deja la cabecera en negro y parece un fallo.
  const heroPool = useMemo(
    () =>
      catalog
        .flatMap((section) => section.items)
        .filter((item) => item.backdrop)
        .slice(0, 12)
        .map(catalogToCard),
    [catalog],
  );

  const seguirViendo = useMemo(
    () => recents.map((channel) => channelToCard(channel, { live: true })),
    [recents],
  );

  const abrirCanal = (card: CardItem) => {
    const canal = channels.find((channel) => `canal-${channel.id}` === card.key);
    if (canal) onTune(canal);
  };

  const abrirFicha = (card: CardItem) => {
    const [mediaType, ...resto] = card.key.split("-");
    onOpenTitle(mediaType, resto.join("-"));
  };

  const tunedCard = tuned ? channelToCard(tuned, { live: true }) : null;

  return (
    <div className={heroPool.length > 0 ? "screen has-hero" : "screen"}>
      {heroPool.length > 0 && (
        <Hero
          pool={heroPool}
          pinned={pinned}
          eyebrow="Destacado"
          onPlay={abrirFicha}
          onDetails={abrirFicha}
        />
      )}

      {tunedCard && (
        <MediaRail
          title="Continuar viendo"
          items={[tunedCard]}
          onOpen={abrirCanal}
          activeKey={tunedCard.key}
        />
      )}

      <MediaRail
        title="Seguir viendo"
        items={seguirViendo}
        onOpen={abrirCanal}
        activeKey={tunedCard?.key ?? null}
      />

      <MediaRail
        title="Tus favoritos"
        items={favoriteChannels.map((channel) => channelToCard(channel))}
        onOpen={abrirCanal}
        count={favoriteChannels.length > 0 ? `${favoriteChannels.length}` : undefined}
        activeKey={tunedCard?.key ?? null}
      />

      {catalog.map((section) => (
        <MediaRail
          key={section.title}
          title={section.title}
          items={section.items.map(catalogToCard)}
          onOpen={abrirFicha}
          onFocus={setPinned}
          posterMode
        />
      ))}

      {grupos.map(({ category, items }) => (
        <MediaRail
          key={category}
          title={category}
          items={items.slice(0, MAX_POR_RIEL).map((channel) => channelToCard(channel))}
          onOpen={abrirCanal}
          count={`${items.length}`}
          activeKey={tunedCard?.key ?? null}
        />
      ))}
    </div>
  );
}
