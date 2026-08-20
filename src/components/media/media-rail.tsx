"use client";

import type { CardItem } from "@/lib/media-item";
import { MediaCard } from "./media-card";
import { RailScroller } from "./rail-scroller";

/**
 * Una fila con título y sus tarjetas.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/media/MediaRail.tsx
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b): el modo póster llega por
 * prop en lugar de leerse de un store global, y el recuento del lado derecho
 * es propio.
 */
export function MediaRail({
  title,
  items,
  onOpen,
  onFocus,
  posterMode,
  activeKey,
  count,
}: {
  title: string;
  items: CardItem[];
  onOpen: (item: CardItem) => void;
  onFocus?: (item: CardItem) => void;
  posterMode?: boolean;
  activeKey?: string | null;
  count?: string;
}) {
  // Un riel vacío no se anuncia: mejor que la fila no exista a que exista con
  // un hueco. Favoritos y Seguir viendo empiezan vacíos siempre.
  if (items.length === 0) return null;

  return (
    <section className={`rail ${posterMode ? "is-poster" : ""}`}>
      <div className="rail-head">
        <h3>{title}</h3>
        {count && <span>{count}</span>}
      </div>
      <RailScroller className="rail-strip" ariaLabel={title}>
        {items.map((item) => (
          <MediaCard
            key={item.key}
            item={item}
            onOpen={onOpen}
            onFocus={onFocus}
            posterMode={posterMode}
            active={activeKey === item.key}
          />
        ))}
      </RailScroller>
    </section>
  );
}
