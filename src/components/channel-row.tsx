"use client";

import { memo } from "react";
import { Star } from "lucide-react";
import { ChannelLogo } from "./channel-tile";
import { getCategoryStyle } from "@/lib/categories";
import type { Channel } from "@/lib/types";

/**
 * Un canal como fila de lista.
 *
 * Convive con la cuadrícula de logos en vez de sustituirla, porque sirven para
 * cosas distintas: los logos se reconocen de un vistazo, pero en una lista de
 * miles de canales caben tres veces más por pantalla y se llega mucho antes
 * bajando con el control remoto. Aquí además cabe el nombre entero y lo que
 * están dando ahora, que en el cuadrito no cabía.
 *
 * Mantiene `data-channel-id` porque es lo que busca la navegación por flechas.
 */
export const ChannelRow = memo(function ChannelRow({
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
      className={`channel-tile group flex items-center gap-3 border-b border-slate-100 px-2 transition focus-within:bg-emerald-50 ${
        selected ? "bg-emerald-50/80" : "hover:bg-slate-50"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(channel)}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left focus:outline-none"
      >
        <span
          aria-hidden="true"
          className={`w-10 shrink-0 text-right text-sm tabular-nums ${
            selected ? "font-bold text-emerald-700" : "text-slate-400"
          }`}
        >
          {channel.number}
        </span>

        <ChannelLogo channel={channel} className="h-10 w-10 text-xs" />

        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[15px] ${
              selected ? "font-bold text-emerald-900" : "font-semibold text-slate-900"
            }`}
          >
            {channel.name}
          </span>
          {/* Lo que dan ahora, si la guía lo trae; si no, la categoría, que
              siempre existe: la fila nunca se queda con un hueco vacío. */}
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
            <span className="truncate">{channel.currentProgram || channel.category || "General"}</span>
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => onToggleFavorite(channel)}
        aria-label={
          channel.isFavorite ? `Quitar ${channel.name} de favoritos` : `Agregar ${channel.name} a favoritos`
        }
        aria-pressed={channel.isFavorite}
        className={`shrink-0 rounded-lg p-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
          channel.isFavorite ? "text-amber-400" : "text-slate-300 hover:text-amber-400"
        }`}
      >
        <Star aria-hidden="true" className={`h-4 w-4 ${channel.isFavorite ? "fill-current" : ""}`} />
      </button>
    </div>
  );
});
