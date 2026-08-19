"use client";

import type { Channel } from "@/lib/types";
import { ChannelTile } from "@/components/channel-tile";

interface ChannelRailProps {
  title: string;
  channels: Channel[];
  favorites: Set<number>;
  tunedId: number | null;
  onSelect: (channel: Channel) => void;
}

export function ChannelRail({ title, channels, favorites, tunedId, onSelect }: ChannelRailProps) {
  if (channels.length === 0) return null;

  return (
    <section className="mt-11" aria-label={title}>
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
        <span className="text-[13px] text-zinc-600">
          {channels.length} {channels.length === 1 ? "canal" : "canales"}
        </span>
      </div>

      <div className="scroll-none -m-1 flex gap-4 overflow-x-auto p-1">
        {channels.map((channel) => (
          <ChannelTile
            key={channel.id}
            channel={channel}
            width={224}
            isFavorite={favorites.has(channel.id)}
            isTuned={channel.id === tunedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
