"use client";

import { useMemo } from "react";
import { MediaRail } from "@/components/media/media-rail";
import { CatalogRows, useAbrirTitulo, type FilaDeTarjetas } from "./catalog-row";
import { enCursoACard, enMiLista } from "@/lib/media-item";
import { useProgreso } from "@/hooks/use-progreso";
import { useContinuar } from "@/hooks/use-continuar";
import { useWatchlist } from "@/hooks/use-watchlist";

/**
 * Las filas curadas de `/peliculas`, con «Seguir viendo» y «Mi lista» encima.
 *
 * Las dos viven en `localStorage` de este aparato, así que no se pueden saber
 * en el servidor que sirvió `filas`: se calculan aquí, en el navegador, igual
 * que en Inicio (`home-view.tsx`).
 *
 * «Mi lista» cruza lo que ya llegó en `filas` con las marcas del aparato.
 * «Seguir viendo» ya no: sale de su propia memoria (`lib/continuar.ts`), que
 * guarda carátula y título con cada entrada. Cruzarlo con `filas` era lo que
 * hacía que una serie encontrada por el buscador desapareciera de la fila en
 * cuanto salías de su ficha, porque no estaba entre las filas curadas.
 */
export function CatalogRowsPersonalizadas({ filas }: { filas: FilaDeTarjetas[] }) {
  const { memoria } = useProgreso();
  const { enCurso } = useContinuar();
  const { ids } = useWatchlist();
  const onAbrir = useAbrirTitulo();

  const continuar = useMemo(
    () => enCurso.map((entrada) => enCursoACard(entrada, memoria)),
    [enCurso, memoria],
  );
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
