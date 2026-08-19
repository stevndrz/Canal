"use client";

import { Search } from "lucide-react";
import type { Channel } from "@/lib/types";
import { TvKeyboard } from "@/components/tv-keyboard";
import { channelMark } from "@/lib/channels";

interface BuscarViewProps {
  results: Channel[];
  search: string;
  onSearchChange: (value: string) => void;
  onTune: (channel: Channel) => void;
}

export function BuscarView({ results, search, onSearchChange, onTune }: BuscarViewProps) {
  return (
    <div className="grid min-h-0 flex-1 gap-8 lg:grid-cols-2">
      <div className="min-w-0">
        <div className="flex items-center gap-3.5 px-1 pb-1">
          <Search aria-hidden="true" strokeWidth={1.5} className="h-5 w-5 shrink-0 text-zinc-500" />
          {/* Input real: teclado físico y táctil funcionan; el de TV alimenta el mismo estado. */}
          <input
            type="search"
            value={search}
            autoFocus
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Escribe o usa el teclado de abajo"
            aria-label="Buscar canales"
            className="min-h-[34px] w-full border-0 bg-transparent text-[26px] font-semibold tracking-tight text-accent outline-none placeholder:text-zinc-600"
          />
        </div>

        <div className="my-3.5 h-px bg-white/10" />

        <TvKeyboard
          onKey={(char) => onSearchChange(search + char)}
          onBackspace={() => onSearchChange(search.slice(0, -1))}
          onClear={() => onSearchChange("")}
        />
      </div>

      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <span className="text-xs uppercase tracking-[0.16em] text-zinc-600">
          {search ? `${results.length} resultados para “${search}”` : "Sugeridos"}
        </span>

        <ul className="scroll-thin m-0 flex min-h-0 flex-1 list-none flex-col gap-1.5 overflow-y-auto p-0 pr-1">
          {results.map((channel) => (
            <li key={channel.id} className="row-virtual">
              <button
                type="button"
                data-nav="row"
                onClick={() => onTune(channel)}
                className="flex min-h-[56px] w-full items-center gap-3.5 rounded-2xl px-3.5 py-2 text-left hover:bg-white/[0.08]"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[11px] border border-hairline bg-mark text-sm font-bold text-zinc-100/60">
                  {channelMark(channel)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium">{channel.name}</span>
                  <span className="mt-0.5 block text-[13px] text-zinc-500">
                    {channel.number} · {channel.category}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
