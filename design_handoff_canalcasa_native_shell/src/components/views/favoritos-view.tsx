"use client";

import { Star } from "lucide-react";
import type { Channel } from "@/lib/types";
import { ChannelTile } from "@/components/channel-tile";

interface FavoritosViewProps {
  channels: Channel[];
  favorites: Set<number>;
  tunedId: number | null;
  onTune: (channel: Channel) => void;
}

export function FavoritosView({ channels, favorites, tunedId, onTune }: FavoritosViewProps) {
  const items = channels.filter((channel) => favorites.has(channel.id));

  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] xl:text-[34px]">Favoritos</h1>
      <p className="mt-2.5 mb-7 text-[15px] text-zinc-500">
        {items.length
          ? `${items.length} canales guardados en este dispositivo`
          : "Se guardan solo en este dispositivo"}
      </p>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-4.5 md:grid-cols-3 xl:grid-cols-4">
          {items.map((channel) => (
            <ChannelTile
              key={channel.id}
              channel={channel}
              isFavorite
              isTuned={channel.id === tunedId}
              onSelect={onTune}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3.5 rounded-card border border-dashed border-white/12 px-6 py-20 text-center">
          <Star aria-hidden="true" strokeWidth={1.5} className="h-[30px] w-[30px] text-zinc-600" />
          <p className="text-base text-zinc-400">Todavía no marcas ningún canal</p>
          <p className="text-sm text-zinc-600">
            Con el canal enfocado, presiona la estrella. Se guardan en este dispositivo.
          </p>
        </div>
      )}
    </>
  );
}
