"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CardItem } from "@/lib/media-item";
import { MediaCard } from "./media-card";
import { RailScroller } from "./rail-scroller";

/**
 * Una fila con título y sus tarjetas, en tres pesos.
 *
 * `posterMode` para el catálogo (carátulas 2:3 y flechas flotantes) y
 * `compacto` para las filas que son **historial y no oferta** —«Seguir
 * viendo», «Tus favoritos»—: informan de lo que ya hiciste, no proponen nada,
 * así que no tienen por qué pesar lo mismo que una sección que sí ofrece algo.
 */
export function MediaRail({
  title,
  items,
  onOpen,
  onFocus,
  posterMode,
  compacto,
  activeKey,
  count,
  href,
  verTodos,
}: {
  title: string;
  items: CardItem[];
  onOpen: (item: CardItem) => void;
  onFocus?: (item: CardItem) => void;
  posterMode?: boolean;
  compacto?: boolean;
  activeKey?: string | null;
  count?: string;
  /** Enlace del título («Acción» → todas las de Acción). Sin él, texto plano. */
  href?: string;
  /**
   * La última ficha del riel: «Ver los 27 ›». Un riel de veinte de una sección
   * de 527 no decía que había más ni cómo llegar; con el mando, además, el
   * título no es un destino. La ficha sí: es la parada natural al final del
   * recorrido hacia la derecha.
   */
  verTodos?: { total: number; de: string; onClick: () => void };
}) {
  // Un riel vacío no se anuncia: mejor que la fila no exista a que exista con
  // un hueco. Favoritos y Seguir viendo empiezan vacíos siempre.
  if (items.length === 0) return null;

  /**
   * En modo póster cada tarjeta va envuelta, y el ancho lo pone el CSS del riel
   * (`--carteles` por breakpoint): carteles enteros por pantalla, sin cortes en
   * el borde. En los demás la tarjeta va suelta y fluida, como en la rejilla de
   * búsqueda. `Fragment` evita repetir la tarjeta entera solo por el envoltorio.
   */
  const Envoltorio = posterMode ? "div" : Fragment;

  return (
    <section className={`rail ${posterMode ? "is-poster" : ""} ${compacto ? "is-compacto" : ""}`}>
      <div className="rail-head">
        {href ? (
          <Link
            data-nav="button"
            href={href}
            className="group flex items-center gap-2 transition-colors hover:text-red-500"
          >
            <h3>{title}</h3>
            {/* La flecha se desliza al pasar el foco o el ratón: señala que el
                título lleva a más, no que la fila entera sea un botón. */}
            <ChevronRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>
        ) : (
          <h3>{title}</h3>
        )}
        {count && <span>{count}</span>}
      </div>

      <RailScroller className="rail-strip" ariaLabel={title} overlay={posterMode}>
        {items.map((item) => (
          <Envoltorio key={item.key}>
            <MediaCard
              item={item}
              onOpen={onOpen}
              onFocus={onFocus}
              posterMode={posterMode}
              active={activeKey === item.key}
            />
          </Envoltorio>
        ))}
        {verTodos && (
          <button
            type="button"
            data-nav="tile"
            // `media-card` por el contrato del foco: las fichas de un riel no
            // llevan el anillo de `globals.css` sino su propio realce (crecer
            // y borde blanco en el marco), y esta es una ficha más del riel.
            className="media-card rail-ver-todos"
            onClick={verTodos.onClick}
            aria-label={`Ver los ${verTodos.total.toLocaleString("es-GT")} canales de ${verTodos.de}`}
          >
            <span className="rail-ver-todos-marco" aria-hidden="true">
              <span className="rail-ver-todos-cifra">{verTodos.total.toLocaleString("es-GT")}</span>
              <ChevronRight />
            </span>
            <span className="rail-ver-todos-texto" aria-hidden="true">
              Ver todos
            </span>
          </button>
        )}
      </RailScroller>
    </section>
  );
}
