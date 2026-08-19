"use client";

import type { Channel } from "@/lib/types";
import { groupByCategory } from "@/lib/channels";

interface CategoriasViewProps {
  channels: Channel[];
  onPick: (category: string) => void;
}

export function CategoriasView({ channels, onPick }: CategoriasViewProps) {
  const groups = groupByCategory(channels);

  return (
    <>
      <h1 className="text-[26px] font-semibold tracking-[-0.03em] xl:text-[34px]">Categorías</h1>
      <p className="mt-2.5 mb-7 text-[15px] text-zinc-500">
        Ordenadas como las clasifica tu lista M3U
      </p>

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-4">
        {groups.map(({ category, items }) => (
          <button
            key={category}
            type="button"
            data-nav="tile"
            onClick={() => onPick(category)}
            className="min-h-[104px] rounded-[16px] border border-hairline bg-white/[0.04] px-5 py-5.5 text-left hover:bg-white/[0.1]"
          >
            <span className="block text-lg font-semibold tracking-tight">{category}</span>
            <span className="mt-2 block text-[13px] text-zinc-500">{items.length} canales</span>
          </button>
        ))}
      </div>
    </>
  );
}
