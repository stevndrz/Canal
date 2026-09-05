"use client";

import { useMemo } from "react";
import { MediaRail } from "@/components/media/media-rail";
import { CatalogRows, useAbrirTitulo, type FilaDeTarjetas } from "./catalog-row";
import { enMiLista, seguirViendo } from "@/lib/media-item";
import { useProgreso } from "@/hooks/use-progreso";
import { useWatchlist } from "@/hooks/use-watchlist";

/**
 * Las filas curadas de `/peliculas`, con «Seguir viendo» y «Mi lista» encima.
 *
 * Las dos viven en `localStorage` de este aparato, así que no se pueden saber
 * en el servidor que sirvió `filas`: se calculan aquí, en el navegador, igual
 * que el progreso de Inicio (`home-view.tsx`).
 *
 * Ninguna de las dos pide nada nuevo a TMDB — se limitan a cruzar lo que ya
 * llegó en `filas` con la memoria del aparato. Ver `seguirViendo` y
 * `enMiLista` en `media-item.ts` para el porqué.
 */
export function CatalogRowsPersonalizadas({ filas }: { filas: FilaDeTarjetas[] }) {
  const { memoria } = useProgreso();
  const { ids } = useWatchlist();
  const onAbrir = useAbrirTitulo();

  const continuar = useMemo(() => seguirViendo(filas, memoria), [filas, memoria]);
  const miLista = useMemo(() => enMiLista(filas, ids), [filas, ids]);

  return (
    <>
      {/* Historial, no oferta: mismo criterio que «Seguir viendo» de Inicio. */}
      <MediaRail compacto title="Seguir viendo" items={continuar} onOpen={onAbrir} posterMode />
      <MediaRail title="Mi lista" items={miLista} onOpen={onAbrir} posterMode />
      <CatalogRows filas={filas} />
    </>
  );
}
