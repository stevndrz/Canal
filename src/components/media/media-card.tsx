"use client";

import { memo, useState } from "react";
import { Tv } from "lucide-react";
import type { CardItem } from "@/lib/media-item";

/**
 * Tarjeta de un riel.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/media/MediaCard.tsx
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b):
 *   - Sin peticiones a TMDB desde la tarjeta. El original pide logo, sinopsis,
 *     duración, nota de IMDb y logotipos de plataforma por cada tarjeta que se
 *     monta; aquí el catálogo ya viene resuelto del servidor, así que la
 *     tarjeta solo pinta. Con listas de más de 500 canales esa diferencia es la
 *     que decide si el carril va fluido o a tirones.
 *   - Fuera Trakt, los servidores domésticos y el menú contextual, que aquí no
 *     existen.
 *   - Añadido el monograma de respaldo: las listas M3U rara vez traen logo, y
 *     un hueco gris es peor que dos letras.
 *
 * Se conserva su estructura de DOM y sus clases al pie de la letra —`.poster`,
 * `.poster-art`, `.card-meta-row`, `.cw-progress`— porque son el contrato con
 * arvio-shell.css.
 */
interface MediaCardProps {
  item: CardItem;
  onOpen: (item: CardItem) => void;
  onFocus?: (item: CardItem) => void;
  /** `true` pinta 2:3 (póster); `false`, 16:9 (apaisado). */
  posterMode?: boolean;
  active?: boolean;
}

function MediaCardBase({ item, onOpen, onFocus, posterMode, active }: MediaCardProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const artwork = posterMode ? item.poster : item.backdrop;

  // Una tarjeta se reutiliza al cambiar de categoría: si no se reinicia el
  // estado, el arte nuevo hereda el "ya cargado" del anterior y aparece de
  // golpe sin su transición, o peor, hereda el fallo y no se muestra nunca.
  //
  // El reinicio va durante el render y no en un efecto: así el primer pintado
  // ya sale correcto. Con un efecto habría un fotograma mostrando el estado del
  // arte anterior, que es justo el parpadeo que se quiere evitar.
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
      className={`media-card ${posterMode ? "is-poster" : ""} ${active ? "is-active" : ""}`}
      onClick={() => onOpen(item)}
      onMouseEnter={() => onFocus?.(item)}
      onFocus={() => onFocus?.(item)}
      title={item.title}
    >
      {/* El destello de espera solo mientras se espera una imagen de verdad.
          Antes bastaba con `!loaded`, y `loaded` solo se pone al cargar un
          `<img>`: una tarjeta sin arte —o con el arte caído— se quedaba
          destellando para siempre, animando en bucle una lista de 7.800. */}
      <div className={`poster ${showArt && !loaded ? "is-loading" : ""}`}>
        {showArt ? (
          // `<img>` a propósito, como en el original: las URLs de logo vienen de
          // cientos de dominios distintos de listas IPTV, y `next/image` exige
          // declarar cada uno en `remotePatterns` o falla en tiempo de ejecución.
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

/**
 * Un riel monta cientos de tarjetas. Sin memoizar, cada re-render del padre
 * —la rotación del hero, un hover— vuelve a renderizarlas todas, que es la
 * causa principal de los tirones al scrollear en vertical.
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
