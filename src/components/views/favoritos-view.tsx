"use client";

import { useCallback, useMemo } from "react";
import { Star } from "lucide-react";
import type { Channel } from "@/lib/types";
import { channelToCard, type CardItem } from "@/lib/media-item";
import { MediaCard } from "@/components/media/media-card";

/**
 * Favoritos.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/watchlist/WatchlistScreen.tsx
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b): se porta el encabezado y la
 * rejilla, y se deja fuera todo su selector de origen —Trakt, Jellyfin, Plex,
 * Emby y sus bibliotecas—, porque aquí solo hay un origen: lo que está marcado
 * en este dispositivo.
 */
interface FavoritosViewProps {
  channels: Channel[];
  favorites: Set<number>;
  tunedId: number | null;
  onTune: (channel: Channel) => void;
}

export function FavoritosView({ channels, favorites, tunedId, onTune }: FavoritosViewProps) {
  // Memorizados: sin esto se recalculaban en cada render y las tarjetas
  // resultantes eran objetos nuevos, así que el `memo` de `MediaCard` no
  // acertaba nunca y se repintaba la rejilla entera por cualquier cambio.
  const tarjetas = useMemo(
    () => channels.filter((channel) => favorites.has(channel.id)).map((canal) => channelToCard(canal)),
    [channels, favorites],
  );

  // Busca en `channels`, el prop estable, y no en una lista derivada que
  // cambia de identidad en cada render.
  const abrir = useCallback(
    (card: CardItem) => {
      const canal = channels.find((channel) => `canal-${channel.id}` === card.key);
      if (canal) onTune(canal);
    },
    [channels, onTune],
  );

  return (
    <div className="screen has-section-heading">
      <section className="section-heading library-heading">
        <div className="library-title-block">
          <p className="eyebrow">Guardados en este dispositivo</p>
          <h2>Favoritos</h2>
        </div>
      </section>

      {tarjetas.length > 0 ? (
        <div className="grid-results">
          {tarjetas.map((item) => (
            <MediaCard
              key={item.key}
              item={item}
              onOpen={abrir}
              active={tunedId !== null && item.key === `canal-${tunedId}`}
            />
          ))}
        </div>
      ) : (
        <div className="watchlist-empty">
          <Star size={30} />
          <p>Todavía no marcas ningún canal</p>
          <span>
            Pulsa la estrella en cualquier canal de la lista. Se guardan solo en este
            dispositivo.
          </span>
        </div>
      )}
    </div>
  );
}
