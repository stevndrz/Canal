"use client";

import { useCallback, useMemo } from "react";
import { Star } from "lucide-react";
import type { Channel } from "@/lib/types";
import { channelToCard, type CardItem } from "@/lib/media-item";
import { MediaCard } from "@/components/media/media-card";

/**
 * Los canales marcados en este aparato.
 *
 * No hay más de un origen ni lo habrá: sin cuentas ni sincronización, «mis
 * favoritos» son los de esta pantalla y punto. La vista lo dice en el
 * antetítulo para que nadie espere encontrarlos en otro aparato.
 */
export function FavoritosView({
  channels,
  favorites,
  tunedId,
  onTune,
}: {
  channels: Channel[];
  favorites: Set<number>;
  tunedId: number | null;
  onTune: (channel: Channel) => void;
}) {
  /**
   * La tarjeta y el canal del que salió, en una sola pasada.
   *
   * Memorizado porque `MediaCard` va con `memo`: recalcular las tarjetas en
   * cada render las convierte en objetos nuevos, el `memo` no acierta nunca y
   * se repinta la rejilla entera por cualquier cambio.
   *
   * Y con un índice por clave en vez de buscar el canal al pulsar: `channels`
   * son 7.822, así que un `find` por clic recorría la lista entera para algo
   * que ya se sabía al construir la tarjeta.
   */
  const { tarjetas, porClave } = useMemo(() => {
    const marcados = channels.filter((canal) => favorites.has(canal.id));
    const tarjetas = marcados.map(channelToCard);
    const porClave = new Map(tarjetas.map((tarjeta, i) => [tarjeta.key, marcados[i]]));
    return { tarjetas, porClave };
  }, [channels, favorites]);

  const abrir = useCallback(
    (tarjeta: CardItem) => {
      const canal = porClave.get(tarjeta.key);
      if (canal) onTune(canal);
    },
    [porClave, onTune],
  );

  return (
    <div className="screen has-section-heading">
      <section className="section-heading library-heading">
        <div className="library-title-block">
          <p className="eyebrow">Guardados en este dispositivo</p>
          <h2>Favoritos</h2>
        </div>
      </section>

      {tarjetas.length === 0 ? (
        <div className="watchlist-empty">
          <Star size={30} />
          <p>Todavía no marcas ningún canal</p>
          <span>
            Pulsa la estrella en cualquier canal de la lista. Se guardan solo en este
            dispositivo.
          </span>
        </div>
      ) : (
        <div className="grid-results">
          {tarjetas.map((tarjeta) => (
            <MediaCard
              key={tarjeta.key}
              item={tarjeta}
              onOpen={abrir}
              active={tunedId !== null && tarjeta.key === `canal-${tunedId}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
