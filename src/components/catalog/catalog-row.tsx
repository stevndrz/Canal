"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { type CardItem } from "@/lib/media-item";
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
export function CatalogGrid({ tarjetas }: { tarjetas: CardItem[] }) {
  const router = useRouter();
  const onAbrir = useCallback((card: CardItem) => abrir(router, card), [router]);
  return (
    <div className="grid-results">
      {tarjetas.map((card) => (
        <MediaCard key={card.key} item={card} onOpen={onAbrir} posterMode />
      ))}
    </div>
  );
}

/** Una fila ya convertida a tarjetas. Ver `FilaDeTarjetas`. */
export interface FilaDeTarjetas {
  title: string;
  href?: string;
  tarjetas: CardItem[];
}

/**
 * Las filas del catálogo, **ya convertidas a tarjetas**.
 *
 * Antes esto recibía `CatalogSection[]`, o sea las fichas completas de TMDB, y
 * llamaba a `catalogToCard` aquí dentro. Como este archivo es de cliente, eso
 * obligaba a **serializar las fichas enteras** en la carga de la página:
 * medido, 200 títulos viajando con `overview`, `tagline`, `generos`,
 * `reparto`, `autoria`, `seasons`, `duracion` y `source` — y una tarjeta solo
 * pinta título, póster, año y nota. Todo lo demás era peso muerto en cada
 * entrada a la sección, y es lo que hacía que «Cine y series» tardara.
 *
 * Es la misma regla que `types.ts` aplica a los canales: si un campo no se
 * pinta, no se manda. Convertir en el servidor cuesta lo mismo y lo que cruza
 * la red es solo lo que se ve.
 */
export function CatalogRows({ filas }: { filas: FilaDeTarjetas[] }) {
  const router = useRouter();
  const onAbrir = useCallback((card: CardItem) => abrir(router, card), [router]);
  return (
    <>
      {filas.map((fila) => (
        <MediaRail
          key={fila.title}
          title={fila.title}
          href={fila.href}
          items={fila.tarjetas}
          onOpen={onAbrir}
          posterMode
        />
      ))}
    </>
  );
}
