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
          <span className="tarjeta-progreso">
            <span style={{ width: `${progress}%` }} />
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
      {/* El marco del cartel. Sus medidas, su sombra en reposo y su realce al
          enfocar viven en `catalogo.css` (`.poster-frame`) y no en utilidades
          aquí: había un `shadow-lg` de Tailwind, y la capa `utilities` gana
          siempre a `components`, donde está el aro de foco. Medido: con el
          mando encima, el cartel crecía pero su sombra era la de `shadow-lg`
          y el aro blanco no llegaba a pintarse. Desde tres metros, un cartel
          un 6 % más grande sin aro no se distingue de sus vecinos. */}
      <div className={`poster-frame ${showArt && !loaded ? "is-loading" : ""}`}>
        {item.enLista && (
          <span className="poster-marca-lista" aria-hidden="true">
            <Bookmark fill="currentColor" />
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
            className={`poster-frame-arte ${loaded ? "is-cargada" : ""}`}
          />
        ) : item.mark ? (
          <span className="poster-frame-hueco poster-frame-marca">{item.mark}</span>
        ) : (
          <span className="poster-frame-hueco">
            <Tv aria-hidden="true" />
          </span>
        )}

        {showProgress && (
          <span className="tarjeta-progreso">
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

export const MediaCard = memo(
  MediaCardBase,
  (prev, next) =>
    prev.item === next.item &&
    prev.posterMode === next.posterMode &&
    prev.active === next.active &&
    prev.onOpen === next.onOpen &&
    prev.onFocus === next.onFocus,
);
