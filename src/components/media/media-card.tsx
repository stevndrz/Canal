"use client";

import { memo, useState } from "react";
import { Tv } from "lucide-react";
import type { CardItem } from "@/lib/media-item";

interface MediaCardProps {
  item: CardItem;
  onOpen: (item: CardItem) => void;
  onFocus?: (item: CardItem) => void;
  /** `true` pinta 2:3 (póster de catálogo); `false`, tarjeta de canal glass. */
  posterMode?: boolean;
  active?: boolean;
}

/**
 * Tarjeta de CANAL — estilo aero minimalista.
 *
 * El logo vive en un badge de cristal oscuro con `object-contain`: los
 * escudos de las listas IPTV vienen en proporciones imposibles y con
 * `object-cover` acababan recortados o estirados. Ahora flotan centrados,
 * enteros, y al enfocar/hover encienden un halo sutil.
 *
 * Sin clases `.media-card`/`.poster` de shell.css a propósito: ese contrato
 * era para los pósters del catálogo; aquí manda la receta Tailwind.
 */
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
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const artwork = item.backdrop ?? item.poster;

  // La tarjeta se reutiliza al cambiar de riel: sin reiniciar loaded/failed,
  // el logo nuevo heredaba el estado del anterior y no aparecía.
  const [artPrevio, setArtPrevio] = useState(artwork);
  if (artPrevio !== artwork) {
    setArtPrevio(artwork);
    setLoaded(false);
    setFailed(false);
  }

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
      className={`group relative flex w-full flex-col overflow-hidden rounded-2xl border bg-neutral-900/60 p-6 text-left shadow-lg backdrop-blur-md transition-all duration-300 hover:border-white/20 ${
        active ? "border-white/30" : "border-white/10"
      }`}
    >
      {/* Badge del logo: panorámico, cristal oscuro, borde fino técnico. */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black/40 ring-1 ring-inset ring-white/5">
        {/* Halo tipo NASA: se enciende al hover/foco detrás del logo. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {showArt ? (
          // `<img>` plano: logos IPTV de cientos de dominios distintos.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artwork as string}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`h-full w-full p-2 object-contain transition-transform duration-300 group-hover:scale-105 ${
              loaded ? "" : "opacity-0"
            }`}
          />
        ) : item.mark ? (
          <span className="absolute inset-0 grid place-items-center font-mono text-2xl tracking-widest text-neutral-500">
            {item.mark}
          </span>
        ) : (
          <span className="absolute inset-0 grid place-items-center text-neutral-600">
            <Tv size={28} aria-hidden="true" />
          </span>
        )}

        {item.badge && (
          <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-200 ring-1 ring-white/10">
            {item.badge}
          </span>
        )}

        {showProgress && (
          <span className="absolute inset-x-3 bottom-2 h-[3px] overflow-hidden rounded-full bg-white/10">
            <span className="block h-full bg-accent" style={{ width: `${progress}%` }} />
          </span>
        )}
      </div>

      {/* Metadatos técnicos: número + categoría en mono discreto. */}
      <strong className="mt-3 truncate font-semibold text-sm text-neutral-200 transition-colors group-hover:text-white">
        {item.title}
      </strong>
      <span className="mt-1 flex items-center gap-1 font-mono text-xs text-neutral-400">
        {item.metaRight && <span>CH {item.metaRight}</span>}
        {item.metaRight && item.meta && <span aria-hidden="true">·</span>}
        {item.meta && <span className="truncate">{item.meta}</span>}
      </span>
    </button>
  );
}

/**
 * Tarjeta de PÓSTER (catálogo TMDB). Markup original: `.media-card` +
 * `.poster` son el contrato visual con shell.css y aquí sigue mandando.
 */
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
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const artwork = item.poster;

  const [artPrevio, setArtPrevio] = useState(artwork);
  if (artPrevio !== artwork) {
    setArtPrevio(artwork);
    setLoaded(false);
    setFailed(false);
  }

  const showArt = Boolean(artwork) && !failed;
  const progress = item.progress ?? 0;
  const showProgress = progress >= 1 && progress <= 94;

  return (
    <button
      type="button"
      data-nav="tile"
      className={`media-card ${active ? "is-active" : ""}`}
      onClick={() => onOpen(item)}
      onMouseEnter={() => onFocus?.(item)}
      onFocus={() => onFocus?.(item)}
      title={item.title}
    >
      <div className={`poster ${showArt && !loaded ? "is-loading" : ""}`}>
        {showArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artwork as string}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`poster-art ${loaded ? "is-loaded" : ""}`}
          />
        ) : item.mark ? (
          <span className="poster-mark">{item.mark}</span>
        ) : (
          <Tv size={42} />
        )}

        {item.badge && <span className="cw-badge top-right">{item.badge}</span>}

        {showProgress && (
          <span className="cw-progress">
            <span style={{ width: `${progress}%` }} />
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

/**
 * Un riel monta cientos de tarjetas. Sin memoizar, cada re-render del padre
 * vuelve a renderizarlas todas.
 */
export const MediaCard = memo(
  MediaCardBase,
  (prev, next) =>
    prev.item === next.item &&
    prev.posterMode === next.posterMode &&
    prev.active === next.active &&
    prev.onOpen === next.onOpen &&
    prev.onFocus === next.onFocus,
);
