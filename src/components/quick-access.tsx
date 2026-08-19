"use client";

import { memo } from "react";
import { Zap } from "lucide-react";
import { ChannelLogo } from "./channel-tile";
import type { Channel } from "@/lib/types";

/**
 * Fila fija con los canales principales, para llegar a ellos de un toque sin
 * recorrer la guía. Se construye en el dashboard emparejando por nombre; si la
 * lista M3U cargada no trae ninguno, no se renderiza nada.
 */
export const QuickAccess = memo(function QuickAccess({
  channels,
  selectedId,
  onSelect,
}: {
  channels: Channel[];
  selectedId: number | undefined;
  onSelect: (channel: Channel) => void;
}) {
  if (channels.length === 0) return null;

  return (
    <section className="mb-5" aria-labelledby="quick-access-heading">
      <h2
        id="quick-access-heading"
        className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500"
      >
        <Zap aria-hidden="true" className="h-3.5 w-3.5 text-amber-500" />
        Acceso rápido
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {channels.map((channel) => {
          const selected = channel.id === selectedId;
          return (
            <button
              key={channel.id}
              type="button"
              onClick={() => onSelect(channel)}
              aria-pressed={selected}
              className={`flex shrink-0 items-center gap-2.5 rounded-2xl border py-2 pl-2 pr-4 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                selected
                  ? "border-transparent bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <ChannelLogo channel={channel} className="h-10 w-10 text-xs" />
              <span className="whitespace-nowrap text-sm font-bold">{channel.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
});
