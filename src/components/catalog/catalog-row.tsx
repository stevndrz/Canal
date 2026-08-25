"use client";

import { useCallback, useMemo } from "react";
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
 *
 * `onAbrir` es estable a propósito: una función nueva por render anularía el
 * `memo` de cada tarjeta y una cuadrilla entera se volvería a pintar por un
 * cambio que no la afecta.
 */
export function CatalogGrid({ items }: { items: ResolvedCatalogItem[] }) {
  const router = useRouter();
  const onAbrir = useCallback((card: CardItem) => abrir(router, card), [router]);
  const tarjetas = useMemo(() => items.map(catalogToCard), [items]);
  return (
    <div className="grid-results">
      {tarjetas.map((card) => (
        <MediaCard key={card.key} item={card} onOpen={onAbrir} posterMode />
      ))}
    </div>
  );
}

export function CatalogRows({ sections }: { sections: CatalogSection[] }) {
  const router = useRouter();
  const onAbrir = useCallback((card: CardItem) => abrir(router, card), [router]);
  return (
    <>
      {sections.map((section) => (
        <FilaCatalogo key={section.title} section={section} onAbrir={onAbrir} />
      ))}
    </>
  );
}

/**
 * Una fila del catálogo. Componente propio para poder derivar las tarjetas con
 * `useMemo` a nivel de hook: en el cuerpo del `map` del padre eso sería ilegal.
 */
function FilaCatalogo({
  section,
  onAbrir,
}: {
  section: CatalogSection;
  onAbrir: (card: CardItem) => void;
}) {
  const tarjetas = useMemo(() => section.items.map(catalogToCard), [section.items]);
  return (
    <MediaRail
      title={section.title}
      href={section.href}
      items={tarjetas}
      onOpen={onAbrir}
      posterMode
    />
  );
}
