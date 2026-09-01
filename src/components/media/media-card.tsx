"use client";

import { memo, useCallback, useState } from "react";
import { Tv } from "lucide-react";
import type { CardItem } from "@/lib/media-item";

interface MediaCardProps {
  item: CardItem;
  onOpen: (item: CardItem) => void;
  onFocus?: (item: CardItem) => void;
  posterMode?: boolean;
  active?: boolean;
}

function useArte(artwork: string | null | undefined) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const [artPrevio, setArtPrevio] = useState(artwork);
  if (artPrevio !== artwork) {
    setArtPrevio(artwork);
    setLoaded(false);
    setFailed(false);
  }

  const alCargar = useCallback(() => setLoaded(true), []);
  const alFallar = useCallback(() => setFailed(true), []);

  const refImg = useCallback((imagen: HTMLImageElement | null) => {
    if (!imagen || !imagen.complete) return;
    if (imagen.naturalWidth > 0) setLoaded(true);
    else setFailed(true);
  }, []);

  return { loaded, failed, refImg, alCargar, alFallar };
}

function ChannelGlassCard({
  item,
  onOpen,
  onFocus,
  active,
}: {
  item: CardItem;
  onOpen: (item: CardItem) => void;
  onFocus?: (item: CardItem) => void;
  active?: boolean;
}) {
  const artwork = item.backdrop ?? item.poster;
  const { loaded, failed, refImg, alCargar, alFallar } = useArte(artwork);

  const showArt = Boolean(artwork) && !failed;
  const progress = item.progress ?? 0;
  const showProgress = progress >= 1 && progress <= 94;

  return (
    <button
      type="button"
      data-nav="tile"
      title={item.title}
      onClick={() => onOpen(item)}
      onMouseEnter={() => onFocus?.(item)}
      onFocus={() => onFocus?.(item)}
      className={`group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-surface/85 p-6 text-left shadow-lg transition-[border-color,transform] duration-300 hover:border-white/20 ${
        active ? "border-white/30" : "border-white/10"
      }`}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/40 ring-1 ring-inset ring-white/5">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {showArt ? (
          <img
            src={artwork as string}
            alt=""
            loading="lazy"
            decoding="async"
            ref={refImg}
            onLoad={alCargar}
            onError={alFallar}
            className={`h-full w-full p-2 object-contain transition-transform duration-300 group-hover:scale-105 ${
              loaded ? "" : "opacity-0"
            }`}
          />
        ) : item.mark ? (
          <span className="absolute inset-0 grid place-items-center font-mono text-2xl tracking-widest text-soft">
            {item.mark}
          </span>
        ) : (
          <span className="absolute inset-0 grid place-items-center text-soft">
            <Tv size={28} aria-hidden="true" />
          </span>
        )}

        {showProgress && (
          <span className="absolute inset-x-3 bottom-2 h-[3px] overflow-hidden rounded-full bg-white/10">
            <span className="block h-full bg-accent" style={{ width: `${progress}%` }} />
          </span>
        )}
      </div>

      <strong className="mt-3 truncate font-semibold text-sm text-muted transition-colors group-hover:text-white">
        {item.title}
      </strong>
      <span className="card-canal-meta mt-1 flex items-center gap-1 font-mono text-xs text-muted">
        {item.metaRight && <span>CH {item.metaRight}</span>}
        {item.metaRight && item.meta && <span aria-hidden="true">·</span>}
        {item.meta && <span className="truncate">{item.meta}</span>}
      </span>
    </button>
  );
}

function PosterCard({
  item,
  onOpen,
  onFocus,
  active,
}: {
  item: CardItem;
  onOpen: (item: CardItem) => void;
  onFocus?: (item: CardItem) => void;
  active?: boolean;
}) {
  const artwork = item.poster;
  const { loaded, failed, refImg, alCargar, alFallar } = useArte(artwork);

  const showArt = Boolean(artwork) && !failed;
  const progress = item.progress ?? 0;
  const showProgress = progress >= 1 && progress <= 94;

  return (
    <button
      type="button"
      data-nav="tile"
      className={`media-card group ${active ? "is-active" : ""}`}
      onClick={() => onOpen(item)}
      onMouseEnter={() => onFocus?.(item)}
      onFocus={() => onFocus?.(item)}
      title={item.title}
    >
      <div
        className={`poster-frame relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-gradient-to-br from-surface-2 to-app shadow-lg transition-[transform,box-shadow] duration-300 ${showArt && !loaded ? "is-loading" : ""}`}
      >
        {showArt ? (
          <img
            src={artwork as string}
            alt=""
            loading="lazy"
            decoding="async"
            ref={refImg}
            onLoad={alCargar}
            onError={alFallar}
            className={`object-cover w-full h-full rounded-xl transition-opacity duration-300 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : item.mark ? (
          <span className="absolute inset-0 grid place-items-center font-mono text-4xl font-bold tracking-widest text-white/30">
            {item.mark}
          </span>
        ) : (
          <span className="absolute inset-0 grid place-items-center text-soft">
            <Tv size={42} aria-hidden="true" />
          </span>
        )}

        {showProgress && (
          <span className="absolute inset-x-3 bottom-2 z-10 h-[3px] overflow-hidden rounded-full bg-white/20">
            <span className="block h-full bg-accent" style={{ width: `${progress}%` }} />
          </span>
        )}
      </div>

      <strong>{item.title}</strong>
      <div className="card-meta-row">
        <span className="card-date">{item.meta}</span>
        {item.metaRight && <span className="card-runtime">{item.metaRight}</span>}
      </div>
    </button>
  );
}

function MediaCardBase({ item, onOpen, onFocus, posterMode, active }: MediaCardProps) {
  return posterMode ? (
    <PosterCard item={item} onOpen={onOpen} onFocus={onFocus} active={active} />
  ) : (
    <ChannelGlassCard item={item} onOpen={onOpen} onFocus={onFocus} active={active} />
  );
}

export const MediaCard = memo(
  MediaCardBase,
  (prev, next) =>
    prev.item === next.item &&
    prev.posterMode === next.posterMode &&
    prev.active === next.active &&
    prev.onOpen === next.onOpen &&
    prev.onFocus === next.onFocus,
);
