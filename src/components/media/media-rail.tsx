"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
 * prop en lugar de leerse de un store global, el recuento del lado derecho
 * es propio y, cuando la fila corresponde a un filtro real del catálogo, el
 * título es un enlace a su cuadrilla completa.
 */
export function MediaRail({
  title,
  items,
  onOpen,
  onFocus,
  posterMode,
  activeKey,
  count,
  href,
}: {
  title: string;
  items: CardItem[];
  onOpen: (item: CardItem) => void;
  onFocus?: (item: CardItem) => void;
  posterMode?: boolean;
  activeKey?: string | null;
  count?: string;
  /** Enlace del título («Acción» → todas las de Acción). Sin él, texto plano. */
  href?: string;
}) {
  // Un riel vacío no se anuncia: mejor que la fila no exista a que exista con
  // un hueco. Favoritos y Seguir viendo empiezan vacíos siempre.
  if (items.length === 0) return null;

  return (
    <section className={`rail ${posterMode ? "is-poster" : ""}`}>
      <div className="rail-head">
        {href ? (
          <Link
            href={href}
            className="group flex items-center gap-2 hover:text-red-500 transition-colors"
          >
            <h3>{title}</h3>
            {/* La flecha se desliza al pasar el foco o el ratón: señala que el
                título lleva a más contenido, no que la fila sea un botón. */}
            <ChevronRight className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>
        ) : (
          <h3>{title}</h3>
        )}
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
