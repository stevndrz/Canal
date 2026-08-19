"use client";

import { Maximize, PictureInPicture2, Play, Search, Star } from "lucide-react";
import type { Channel } from "@/lib/types";
import { ChannelList } from "@/components/channel-list";
import { channelMark } from "@/lib/channels";

interface CanalesViewProps {
  channels: Channel[];
  tuned: Channel | null;
  favorites: Set<number>;
  categories: string[];
  category: string;
  search: string;
  onCategoryChange: (category: string) => void;
  onTune: (channel: Channel) => void;
  onToggleFavorite: (id: number) => void;
  onOpenSearch: () => void;
}

export function CanalesView({
  channels,
  tuned,
  favorites,
  categories,
  category,
  search,
  onCategoryChange,
  onTune,
  onToggleFavorite,
  onOpenSearch,
}: CanalesViewProps) {
  const isFavorite = tuned ? favorites.has(tuned.id) : false;

  const actionClass =
    "inline-flex min-h-[50px] items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] px-5 text-base font-medium hover:bg-white/[0.13]";

  return (
    <div className="grid min-h-0 flex-1 gap-8 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
      <div className="flex min-w-0 flex-col gap-5">
        {tuned && (
          <>
            <button
              type="button"
              data-nav="button"
              autoFocus
              onClick={() => onTune(tuned)}
              className="w-full rounded-card"
              aria-label={`Ver ${tuned.name} en pantalla completa`}
            >
              <div className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-[19px] bg-black">
                <span className="text-[72px] font-bold tracking-[-0.04em] text-zinc-100/[0.06]">
                  {channelMark(tuned)}
                </span>

                <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/72 to-transparent px-5 py-4.5">
                  <span className="inline-flex items-center gap-2.5 text-xs font-semibold tracking-[0.14em]">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
                    EN VIVO
                  </span>
                </div>

                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/78 to-transparent px-5 py-4.5">
                  <div className="min-w-0 text-left">
                    <p className="text-xs uppercase tracking-[0.14em] text-zinc-100/55">
                      {tuned.category}
                    </p>
                    <p className="mt-1.5 truncate text-xl font-semibold tracking-tight">
                      {tuned.number} · {tuned.name}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 text-[13px] text-zinc-100/55">
                    <Maximize aria-hidden="true" strokeWidth={1.5} className="h-[15px] w-[15px]" />
                    Pantalla completa
                  </span>
                </div>
              </div>
            </button>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                data-nav="button"
                onClick={() => onTune(tuned)}
                className="inline-flex min-h-[50px] items-center gap-2.5 rounded-2xl bg-accent px-5 text-base font-medium text-accent-on"
              >
                <Play aria-hidden="true" strokeWidth={1.5} className="h-[18px] w-[18px]" />
                Ver en pantalla completa
              </button>

              <button
                type="button"
                data-nav="button"
                aria-pressed={isFavorite}
                onClick={() => onToggleFavorite(tuned.id)}
                className={actionClass}
              >
                <Star
                  aria-hidden="true"
                  strokeWidth={1.5}
                  className={`h-[18px] w-[18px] ${isFavorite ? "fill-accent" : ""}`}
                />
                {isFavorite ? "En favoritos" : "Favorito"}
              </button>

              <button
                type="button"
                data-nav="button"
                onClick={() => document.querySelector("video")?.requestPictureInPicture?.()}
                className={actionClass}
              >
                <PictureInPicture2 aria-hidden="true" strokeWidth={1.5} className="h-[18px] w-[18px]" />
                PIP
              </button>
            </div>

            <p className="max-w-[62ch] text-[15px] leading-relaxed text-zinc-400">
              {tuned.description}
            </p>
          </>
        )}

        <div className="mt-auto hidden items-center gap-5 pt-3 text-xs text-zinc-600 lg:flex">
          <span>↑↓ mover</span>
          <span>OK sintonizar</span>
          <span>0-9 canal directo</span>
          <span>Atrás volver</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3.5">
        <button
          type="button"
          data-nav="button"
          onClick={onOpenSearch}
          className="inline-flex min-h-[50px] w-full items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] px-5 text-base text-zinc-400 hover:bg-white/[0.13]"
        >
          <Search aria-hidden="true" strokeWidth={1.5} className="h-[17px] w-[17px]" />
          <span className="flex-1 truncate text-left">{search || "Buscar canal…"}</span>
        </button>

        <div className="scroll-none flex gap-2 overflow-x-auto pb-0.5" role="tablist">
          {categories.map((item) => {
            const active = item === category;
            return (
              <button
                key={item}
                type="button"
                data-nav="chip"
                role="tab"
                aria-selected={active}
                onClick={() => onCategoryChange(item)}
                className={`inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full border px-4.5 text-sm font-medium ${
                  active
                    ? "border-transparent bg-accent text-accent-on"
                    : "border-white/10 bg-white/[0.05] text-zinc-300 hover:bg-white/[0.12]"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>

        <ChannelList
          channels={channels}
          favorites={favorites}
          tunedId={tuned?.id ?? null}
          onSelect={onTune}
          onToggleFavorite={onToggleFavorite}
        />
      </div>
    </div>
  );
}
