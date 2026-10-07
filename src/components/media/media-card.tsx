"use client";

import { memo, useCallback, useState, type SyntheticEvent } from "react";
import { Bookmark, Tv } from "lucide-react";
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

  /**
   * `onLoad` dispara cuando la petición HTTP termina bien, pero eso no
   * garantiza que haya píxeles: un CDN con protección «anti-hotlink» puede
   * responder 200 con su propio marcador de «imagen rota» en vez de negarse
   * limpio con un error de red, y ese sí carga. `naturalWidth` distingue
   * una cosa de la otra.
   */
  const alCargar = useCallback((evento: SyntheticEvent<HTMLImageElement>) => {
    if (evento.currentTarget.naturalWidth > 0) setLoaded(true);
    else setFailed(true);
  }, []);
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

  /* La tarjeta de canal, al estilo de Apple TV: el logo ES la tarjeta, y el
     texto va debajo, suelto. Antes era una caja con borde y relleno que
     contenía otra caja con borde —dos marcos para un logo—, y en el teléfono
     se leía como un formulario. Usa las piezas de `shell.css` (`.media-card`,
     `.poster`), así que el foco es el de todas las carátulas: crece y se
     rodea de blanco. */
  return (
    <button
      type="button"
      data-nav="tile"
      title={item.title}
      onClick={() => onOpen(item)}
      onMouseEnter={() => onFocus?.(item)}
      onFocus={() => onFocus?.(item)}
      className={`media-card is-canal ${active ? "is-active" : ""}`}
    >
      <div className="poster">
        {showArt ? (
          <img
            src={artwork as string}
            alt=""
            loading="lazy"
            decoding="async"
            ref={refImg}
            referrerPolicy="no-referrer"
            onLoad={alCargar}
            onError={alFallar}
            className={loaded ? "" : "opacity-0"}
          />
        ) : item.mark ? (
          <span className="canal-marca">{item.mark}</span>
        ) : (
          <Tv size={28} aria-hidden="true" className="text-soft" />
        )}

        {showProgress && (
          <span className="absolute inset-x-3 bottom-2 h-[3px] overflow-hidden rounded-full bg-white/10">
            <span className="block h-full bg-accent" style={{ width: `${progress}%` }} />
          </span>
        )}
      </div>

      <strong>{item.title}</strong>
      <span className="card-meta-row card-canal-meta">
        {item.metaRight && <span className="shrink-0 whitespace-nowrap">{item.metaRight}</span>}
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
        {item.enLista && (
          <span
            className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-white"
            aria-hidden="true"
          >
            <Bookmark size={13} fill="currentColor" />
          </span>
        )}

        {showArt ? (
          <img
            src={artwork as string}
            alt=""
            loading="lazy"
            decoding="async"
            ref={refImg}
            referrerPolicy="no-referrer"
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
