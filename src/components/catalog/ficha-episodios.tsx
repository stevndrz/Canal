"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { useGridNavigation } from "@/hooks/use-grid-navigation";
import type { ResolvedCatalogItem, ResolvedEpisode } from "@/lib/catalog/types";

/**
 * Temporadas y episodios de una serie.
 *
 * Extraído de `TitleDetail`. Se lleva con él su `useGridNavigation`, que es lo
 * que deja recorrer la lista con un mando: antes ese `ref` vivía en el
 * componente grande junto a otros cuatro estados que no tenían nada que ver
 * con los episodios.
 *
 * Las temporadas son **enlaces** y no botones porque cada una es una URL
 * (`?t=2`): se puede compartir y volver con Atrás.
 */
export function FichaEpisodios({
  item,
  episodes,
  selectedSeason,
  selectedEpisode,
  onSelectEpisode,
}: {
  item: ResolvedCatalogItem;
  episodes: ResolvedEpisode[];
  selectedSeason: number;
  selectedEpisode: ResolvedEpisode | null;
  onSelectEpisode: (episode: ResolvedEpisode) => void;
}) {
  const listaRef = useRef<HTMLDivElement | null>(null);
  useGridNavigation(listaRef, "[data-episode]");

  return (
    <section className="ficha-seccion">
      <div className="ficha-episodios-cabecera">
        <h2>Episodios</h2>
        {item.seasons.length > 1 && (
          <div className="catalogo-filtros" role="tablist" aria-label="Temporadas">
            {item.seasons.map((season) => (
              <Link
                key={season}
                href={`/peliculas/tv/${item.id}?t=${season}`}
                role="tab"
                data-nav="button"
                aria-selected={season === selectedSeason}
                className={`catalogo-chip ${season === selectedSeason ? "is-active" : ""}`}
              >
                Temporada {season}
              </Link>
            ))}
          </div>
        )}
      </div>

      {episodes.length === 0 ? (
        <p className="ficha-vacio">
          No hay episodios listados. Añade la clave de TMDB para que se rellenen solos.
        </p>
      ) : (
        <div ref={listaRef} className="ficha-episodios">
          {episodes.map((episode) => {
            const activo = selectedEpisode?.episode === episode.episode;
            return (
              <button
                key={`${episode.season}-${episode.episode}`}
                type="button"
                data-episode
                data-nav="row"
                onClick={() => onSelectEpisode(episode)}
                aria-pressed={activo}
                className={`ficha-episodio ${activo ? "is-active" : ""}`}
              >
                <span className="ficha-episodio-arte">
                  {episode.still ? (
                    <Image src={episode.still} alt="" width={224} height={126} />
                  ) : (
                    `E${episode.episode}`
                  )}
                </span>
                <span className="ficha-episodio-texto">
                  <strong>
                    {episode.episode}. {episode.title}
                  </strong>
                  {episode.overview && <span>{episode.overview}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
