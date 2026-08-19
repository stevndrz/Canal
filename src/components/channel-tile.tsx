"use client";

import { memo, useState } from "react";
import { Star } from "lucide-react";
import { getCategoryStyle } from "@/lib/categories";
import type { Channel } from "@/lib/types";

/**
 * Logo del canal con respaldo en monograma: los logos vienen de dominios
 * arbitrarios, así que cualquiera puede fallar sin que eso rompa la guía.
 */
export const ChannelLogo = memo(function ChannelLogo({
  channel,
  className = "",
}: {
  channel: Channel;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const style = getCategoryStyle(channel.category);
  const showLogo = Boolean(channel.logoUrl) && !failed;

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-black shadow-inner ${style.tint} ${style.text} ${className}`}
    >
      {/* El monograma va siempre debajo: si el logo tarda o falla nunca se ve
          el ícono de imagen rota, solo la inicial del canal. */}
      <span aria-hidden={showLogo && loaded}>{channel.logoText}</span>
      {showLogo && (
        // eslint-disable-next-line @next/next/no-img-element -- dominios arbitrarios del M3U: next/image no puede optimizarlos
        <img
          src={channel.logoUrl}
          alt=""
          className={`absolute inset-0 h-full w-full bg-white object-contain p-1.5 transition-opacity duration-200 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
});

export const ChannelTile = memo(function ChannelTile({
  channel,
  selected,
  onSelect,
  onToggleFavorite,
}: {
  channel: Channel;
  selected: boolean;
  onSelect: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
}) {
  const style = getCategoryStyle(channel.category);

  return (
    <div
      data-channel-id={channel.id}
      className={`channel-tile group relative flex flex-col items-center rounded-2xl border p-3 text-center shadow-sm transition duration-200 focus-within:ring-4 focus-within:ring-emerald-400 ${
        selected
          ? `scale-[1.03] border-transparent bg-white shadow-xl ring-2 ${style.ring}`
          : "border-slate-200/80 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(channel)}
        aria-pressed={selected}
        className="flex w-full flex-col items-center gap-2 focus:outline-none"
      >
        <ChannelLogo channel={channel} className="h-16 w-16 text-lg sm:h-20 sm:w-20" />
        <span className="w-full truncate text-sm font-semibold text-slate-900 sm:text-[15px]">{channel.name}</span>
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {channel.number}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onToggleFavorite(channel)}
        aria-label={
          channel.isFavorite ? `Quitar ${channel.name} de favoritos` : `Agregar ${channel.name} a favoritos`
        }
        aria-pressed={channel.isFavorite}
        className={`absolute right-1.5 top-1.5 rounded-full bg-white/80 p-1.5 shadow-sm backdrop-blur-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          channel.isFavorite ? "text-amber-400" : "text-slate-300 hover:text-amber-400"
        }`}
      >
        <Star aria-hidden="true" className={`h-4 w-4 ${channel.isFavorite ? "fill-current" : ""}`} />
      </button>
    </div>
  );
});
