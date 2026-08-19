"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Film, Star, Tv2 } from "lucide-react";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";

/** Tamaño fijo del póster: acota la RAM de imágenes en TVs con poca memoria. */
const POSTER_WIDTH = 180;
const POSTER_HEIGHT = 270; // proporción 2:3, la estándar de los pósters

export function PosterCard({ item }: { item: ResolvedCatalogItem }) {
  const [failed, setFailed] = useState(false);
  const showPoster = Boolean(item.poster) && !failed;
  const Icon = item.mediaType === "tv" ? Tv2 : Film;

  return (
    <Link
      href={`/peliculas/${item.mediaType}/${item.id}`}
      data-poster-card
      className="group block w-[132px] shrink-0 rounded-xl transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 sm:w-[180px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-slate-800 shadow-lg ring-1 ring-white/10 transition duration-200 group-hover:scale-[1.04] group-focus-visible:scale-[1.04]">
        {showPoster ? (
          <Image
            src={item.poster as string}
            alt=""
            width={POSTER_WIDTH}
            height={POSTER_HEIGHT}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          // Respaldo cuando no hay póster: nunca se ve una imagen rota.
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-700 to-slate-900 p-3 text-center">
            <Icon aria-hidden="true" className="h-8 w-8 text-white/50" />
            <span className="line-clamp-3 text-xs font-semibold text-white/80">{item.title}</span>
          </div>
        )}

        {item.rating !== null && item.rating > 0 && (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-amber-300 backdrop-blur-sm">
            <Star aria-hidden="true" className="h-3 w-3 fill-current" />
            {item.rating.toFixed(1)}
          </span>
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-sm font-semibold text-white/90">{item.title}</p>
      {item.year && <p className="text-xs text-white/45">{item.year}</p>}
    </Link>
  );
}
