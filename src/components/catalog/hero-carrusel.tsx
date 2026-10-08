"use client";

import { useState } from "react";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";
import { HeroDestacado } from "./hero-destacado";

export interface Destacado {
  item: ResolvedCatalogItem;
  trailerUrl: string | null;
  logoUrl: string | null;
}

/**
 * Varios destacados en el héroe, con puntos para cambiar entre ellos.
 *
 * **Nunca cambia solo.** Un carrusel automático mueve el fondo mientras
 * alguien lee la sinopsis y, con el mando, se lleva el botón que se iba a
 * pulsar. Aquí solo cambia cuando la persona elige un punto: con el dedo, el
 * ratón, o con el mando (bajar desde «Ver ahora», ← → y OK).
 *
 * Los puntos son botones de verdad, con nombre («Destacado 2 de 5: Duna»)
 * para el lector de pantalla, y crecen en la tele y bajo el dedo hasta los
 * 44 px de objetivo aunque el punto que se ve sea pequeño.
 */
export function HeroCarrusel({ destacados }: { destacados: Destacado[] }) {
  const [actual, setActual] = useState(0);
  const elegido = destacados[Math.min(actual, destacados.length - 1)];
  if (!elegido) return null;

  const puntos =
    destacados.length > 1 ? (
      <div className="hero-puntos" role="group" aria-label="Elegir destacado" data-nav-grupo>
        {destacados.map((d, i) => (
          <button
            key={d.item.id}
            type="button"
            data-nav="button"
            className={`hero-punto ${i === actual ? "is-actual" : ""}`}
            aria-pressed={i === actual}
            aria-label={`Destacado ${i + 1} de ${destacados.length}: ${d.item.title}`}
            title={d.item.title}
            onClick={() => setActual(i)}
          >
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
    ) : null;

  return (
    // Sin `key` por título, a propósito: con ella React montaría el héroe de
    // nuevo al cambiar, los puntos incluidos, y el foco del mando se perdería
    // justo en el botón que se acaba de pulsar.
    <HeroDestacado
      item={elegido.item}
      trailerUrl={elegido.trailerUrl}
      logoUrl={elegido.logoUrl}
      pie={puntos}
    />
  );
}
