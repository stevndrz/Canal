"use client";

import { useRouter } from "next/navigation";
import type { ResolvedCatalogItem, CatalogSection } from "@/lib/catalog/types";
import { catalogToCard, type CardItem } from "@/lib/media-item";
import { MediaCard } from "@/components/media/media-card";
import { MediaRail } from "@/components/media/media-rail";

/**
 * El catálogo, con las mismas piezas que Inicio.
 *
 * Antes tenía su propia rejilla de pósters de ancho fijo (132px en teléfono,
 * 180px arriba). En un televisor de 1920 eso dejaba dos carátulas diminutas
 * arriba a la izquierda y el resto de la pantalla en negro, mientras Inicio —a
 * cuatro pulsaciones de distancia— pintaba las suyas del tamaño correcto.
 *
 * Reutilizar `MediaRail` y `MediaCard` no es solo coherencia visual: trae
 * gratis lo que ya estaba resuelto ahí —tamaños fluidos, flechas de carril,
 * navegación con mando, arrastre con anclaje en táctil y el recorte de pintado
 * de los carriles lejanos— en lugar de volver a resolverlo aquí peor.
 */
function abrir(router: ReturnType<typeof useRouter>, card: CardItem) {
  const [mediaType, ...resto] = card.key.split("-");
  router.push(`/peliculas/${mediaType}/${resto.join("-")}`);
}

/**
 * Resultados de búsqueda o de un filtro.
 *
 * Aquí sí es una rejilla que envuelve, no un carril: una búsqueda devuelve una
 * lista sin orden temático, y obligar a recorrerla en horizontal con un mando
 * sería peor que dejarla fluir en varias líneas.
 */
export function CatalogGrid({ items }: { items: ResolvedCatalogItem[] }) {
  const router = useRouter();
  return (
    <div className="grid-results">
      {items.map((item) => {
        const card = catalogToCard(item);
        return (
          <MediaCard key={card.key} item={card} onOpen={(c) => abrir(router, c)} posterMode />
        );
      })}
    </div>
  );
}

export function CatalogRows({ sections }: { sections: CatalogSection[] }) {
  const router = useRouter();
  return (
    <>
      {sections.map((section) => (
        <MediaRail
          key={section.title}
          title={section.title}
          href={section.href}
          items={section.items.map(catalogToCard)}
          onOpen={(c) => abrir(router, c)}
          posterMode
        />
      ))}
    </>
  );
}
