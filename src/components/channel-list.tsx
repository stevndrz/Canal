"use client";

import { Star } from "lucide-react";
import type { Channel } from "@/lib/types";
import { channelMark } from "@/lib/channels";
import { scrollNearest } from "@/hooks/use-spatial-nav";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface ChannelListProps {
  channels: Channel[];
  favorites: Set<number>;
  tunedId: number | null;
  onSelect: (channel: Channel) => void;
  onToggleFavorite: (id: number) => void;
  /** Índice A-Z lateral: imprescindible con listas de 500+. */
  showAlphaIndex?: boolean;
  compact?: boolean;
}

export function ChannelList({
  channels,
  favorites,
  tunedId,
  onSelect,
  onToggleFavorite,
  showAlphaIndex = true,
  compact = false,
}: ChannelListProps) {
  const jumpTo = (letter: string) => {
    const target = channels.find((channel) => channel.name.toUpperCase().startsWith(letter));
    if (!target) return;
    const el = document.querySelector<HTMLElement>(`[data-channel-row="${target.id}"]`);
    if (el) {
      el.focus();
      scrollNearest(el);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 gap-2">
      <ul
        className="scroll-thin flex min-w-0 flex-1 list-none flex-col gap-1.5 overflow-y-auto pr-1 pl-0 m-0"
        aria-label="Canales"
      >
        {channels.map((channel) => {
          const isFavorite = favorites.has(channel.id);
          const isTuned = channel.id === tunedId;

          return (
            <li key={channel.id} className="row-virtual">
              <div
                className={`flex w-full items-center gap-2.5 rounded-2xl border px-3.5 ${
                  compact ? "min-h-[56px] py-2" : "min-h-[68px] py-2.5"
                } ${
                  isTuned ? "border-white/12 bg-white/[0.05]" : "border-transparent"
                } hover:bg-white/[0.08]`}
              >
                <button
                  type="button"
                  data-nav="row"
                  data-channel-row={channel.id}
                  onClick={() => onSelect(channel)}
                  className="flex min-w-0 flex-1 items-center gap-3.5 rounded-xl text-left"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] border border-hairline bg-mark text-sm font-bold tracking-tight text-zinc-100/60">
                    {channelMark(channel)}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium">{channel.name}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-zinc-500">
                      {channel.number} · {channel.category}
                    </span>
                  </span>

                  {isTuned && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] tracking-[0.12em]">
                      <span className="live-dot h-[5px] w-[5px] rounded-full bg-live" />
                      AHORA
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  data-nav="star"
                  aria-label={`${isFavorite ? "Quitar" : "Agregar"} ${channel.name} ${
                    isFavorite ? "de" : "a"
                  } favoritos`}
                  aria-pressed={isFavorite}
                  onClick={() => onToggleFavorite(channel.id)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px]"
                >
                  <Star
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className={`h-[17px] w-[17px] ${
                      isFavorite ? "fill-accent text-accent" : "text-zinc-600"
                    }`}
                  />
                </button>
              </div>
            </li>
          );
        })}

        {channels.length === 0 && (
          <li className="rounded-card border border-dashed border-white/12 px-6 py-16 text-center text-[15px] text-zinc-500">
            Ningún canal coincide con ese filtro.
          </li>
        )}
      </ul>

      {showAlphaIndex && (
        <div className="scroll-none hidden shrink-0 flex-col gap-px overflow-y-auto xl:flex">
          {LETTERS.map((letter) => {
            const exists = channels.some((channel) => channel.name.toUpperCase().startsWith(letter));
            return (
              <button
                key={letter}
                type="button"
                disabled={!exists}
                onClick={() => jumpTo(letter)}
                className={`grid h-[22px] w-[26px] place-items-center rounded-md text-[11px] font-semibold ${
                  exists ? "text-zinc-500 hover:text-accent" : "text-zinc-800"
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
