"use client";

import { useRef } from "react";
import { PosterCard } from "./poster-card";
import { useGridNavigation } from "@/hooks/use-grid-navigation";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";

export interface CatalogSection {
  title: string;
  items: ResolvedCatalogItem[];
}

/**
 * Filas horizontales de pósters, al estilo de las plataformas de streaming.
 *
 * Todas las filas comparten **un solo contenedor de navegación** a propósito:
 * así las flechas izquierda/derecha recorren la fila actual y arriba/abajo
 * saltan a la fila vecina. Si cada fila gestionara sus propias teclas, con el
 * control remoto se quedaría uno atrapado en la primera.
 */
export function CatalogRows({ sections }: { sections: CatalogSection[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useGridNavigation(containerRef, "[data-poster-card]");

  return (
    <div ref={containerRef}>
      {sections.map((section) => (
        <section key={section.title} className="mb-8">
          <h2 className="mb-3 text-lg font-bold tracking-tight text-white sm:text-xl">{section.title}</h2>
          <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-none sm:gap-4">
            {section.items.map((item) => (
              <PosterCard key={`${item.mediaType}-${item.id}`} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
