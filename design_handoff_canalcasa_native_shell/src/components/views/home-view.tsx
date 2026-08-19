"use client";

import { Play, Star } from "lucide-react";
import type { Channel } from "@/lib/types";
import { ChannelRail } from "@/components/channel-rail";
import { channelMark, groupByCategory } from "@/lib/channels";

interface HomeViewProps {
  channels: Channel[];
  tuned: Channel | null;
  favorites: Set<number>;
  recents: Channel[];
  onTune: (channel: Channel) => void;
  onToggleFavorite: (id: number) => void;
}

/** Inicio lean-back: hero de "seguir viendo" + rieles. Nada de rejilla plana. */
export function HomeView({
  channels,
  tuned,
  favorites,
  recents,
  onTune,
  onToggleFavorite,
}: HomeViewProps) {
  const favoriteChannels = channels.filter((channel) => favorites.has(channel.id));
  const groups = groupByCategory(channels).slice(0, 6);
  const isFavorite = tuned ? favorites.has(tuned.id) : false;

  return (
    <>
      {tuned && (
        <section className="grid items-center gap-8 pb-2 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
              Continuar viendo
            </span>

            <h1 className="mt-3.5 text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] xl:text-[34px]">
              {tuned.name}
            </h1>
            <p className="mt-2.5 text-base text-zinc-400">
              {tuned.number} · {tuned.category} · en vivo ahora
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                data-nav="button"
                autoFocus
                onClick={() => onTune(tuned)}
                className="inline-flex min-h-[50px] items-center gap-2.5 rounded-2xl bg-accent px-5.5 text-base font-medium text-accent-on"
              >
                <Play aria-hidden="true" strokeWidth={1.5} className="h-[19px] w-[19px]" />
                Ver ahora
              </button>

              <button
                type="button"
                data-nav="button"
                aria-pressed={isFavorite}
                onClick={() => onToggleFavorite(tuned.id)}
                className="inline-flex min-h-[50px] items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] px-5.5 text-base font-medium hover:bg-white/[0.13]"
              >
                <Star
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className={`h-[18px] w-[18px] ${isFavorite ? "fill-accent" : ""}`}
                />
                {isFavorite ? "En favoritos" : "Añadir a favoritos"}
              </button>
            </div>
          </div>

          <div className="relative grid aspect-video place-items-center overflow-hidden rounded-card border border-hairline bg-surface">
            <span className="text-[64px] font-bold tracking-[-0.04em] text-zinc-100/[0.07]">
              {channelMark(tuned)}
            </span>
            <span className="absolute left-4 top-3.5 inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em]">
              <span className="h-1.5 w-1.5 rounded-full bg-live" />
              EN VIVO
            </span>
          </div>
        </section>
      )}

      <ChannelRail
        title="Seguir viendo"
        channels={recents}
        favorites={favorites}
        tunedId={tuned?.id ?? null}
        onSelect={onTune}
      />
      <ChannelRail
        title="Tus favoritos"
        channels={favoriteChannels}
        favorites={favorites}
        tunedId={tuned?.id ?? null}
        onSelect={onTune}
      />
      {groups.map(({ category, items }) => (
        <ChannelRail
          key={category}
          title={category}
          channels={items.slice(0, 20)}
          favorites={favorites}
          tunedId={tuned?.id ?? null}
          onSelect={onTune}
        />
      ))}
    </>
  );
}
