"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Check, Play } from "lucide-react";
import { useGridNavigation } from "@/hooks/use-grid-navigation";
import { useEpisodiosVistos } from "@/hooks/use-episodios-vistos";
import {
  type FiltroEpisodios,
  claveDeEpisodio,
  cuantosVistos,
  estaVisto,
  filtrarEpisodios,
} from "@/lib/episodios-vistos";
import type { ResolvedCatalogItem, ResolvedEpisode } from "@/lib/catalog/types";

/**
 * Temporadas y episodios de una serie.
 *
 * Las temporadas son **enlaces** y no botones porque cada una es una URL
 * (`?t=2`): se puede compartir y volver con Atrás.
 *
 * Lo que se ha visto se marca aquí y no se deduce del progreso: en
 * `progreso.ts`, terminar algo **borra** su entrada —es lo que mantiene sola
 * la fila de continuar—, así que esa memoria no distingue lo acabado de lo que
 * nunca se abrió. Ver `lib/episodios-vistos.ts`.
 *
 * El marcado es a mano por necesidad, no por gusto: casi todos los servidores
 * de esta app son iframes de otro dominio, y desde fuera no hay forma de saber
 * si el capítulo llegó al final. Con «Mi enlace» y los servidores «Directo» sí
 * se marca solo, y el botón sigue estando para corregirlo.
 */
const PESTAÑAS: { id: FiltroEpisodios; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "porver", label: "Por ver" },
  { id: "vistos", label: "Vistos" },
];

export function FichaEpisodios({
  item,
  claveBase,
  episodes,
  selectedSeason,
  selectedEpisode,
  onSelectEpisode,
}: {
  item: ResolvedCatalogItem;
  /** La clave de la tarjeta (`"tv-tmdb-125988"`). Ver `claveCatalogo`. */
  claveBase: string;
  episodes: ResolvedEpisode[];
  selectedSeason: number;
  selectedEpisode: ResolvedEpisode | null;
  onSelectEpisode: (episode: ResolvedEpisode) => void;
}) {
  const listaRef = useRef<HTMLDivElement | null>(null);
  useGridNavigation(listaRef, "[data-episode]");

  const { ids: vistos, toggle } = useEpisodiosVistos();
  const [filtro, setFiltro] = useState<FiltroEpisodios>("todos");

  const visibles = useMemo(
    () => filtrarEpisodios(episodes, vistos, claveBase, filtro),
    [episodes, vistos, claveBase, filtro],
  );
  const contados = cuantosVistos(vistos, claveBase, episodes);

  return (
    <section className="ficha-seccion" id="episodios">
      <div className="ficha-episodios-cabecera">
        <h2>Episodios</h2>

        {/* El recuento en la cabecera y no en cada fila: es lo que contesta
            «¿por dónde iba en esta temporada?» de un vistazo. */}
        {episodes.length > 0 && (
          <span className="ficha-episodios-cuenta">
            {contados} de {episodes.length} vistos
          </span>
        )}

        {item.seasons.length > 1 && (
          <div className="catalogo-filtros" role="tablist" aria-label="Temporadas">
            {item.seasons.map((season) => (
              <Link
                key={season}
                href={`/peliculas/tv/${item.id}?t=${season}#episodios`}
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

      {/* Pestañas de estado. Son botones y no enlaces —al revés que las
          temporadas— porque no cambian lo que el servidor tiene que traer:
          filtran una lista que ya está en pantalla, y meterlas en la URL
          obligaría a un viaje de ida y vuelta por esconder cuatro filas. */}
      {episodes.length > 0 && (
        <div className="catalogo-filtros ficha-episodios-pestanas" role="tablist" aria-label="Estado">
          {PESTAÑAS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              data-nav="button"
              aria-selected={filtro === id}
              onClick={() => setFiltro(id)}
              className={`catalogo-chip ${filtro === id ? "is-active" : ""}`}
            >
              {/* Sin insignia con el número: «3 de 10 vistos» ya está en la
                  cabecera, a dos dedos de aquí, y repetirlo dentro de cada
                  píldora era ruido en la pantalla donde menos sitio hay. */}
              {label}
            </button>
          ))}
        </div>
      )}

      {episodes.length === 0 ? (
        <p className="ficha-vacio">
          No hay episodios listados. Añade la clave de TMDB para que se rellenen solos.
        </p>
      ) : visibles.length === 0 ? (
        <p className="ficha-vacio">
          {filtro === "vistos"
            ? "Todavía no has marcado ningún capítulo de esta temporada."
            : "Has visto la temporada entera. Cambia de temporada o quita alguna marca."}
        </p>
      ) : (
        <div ref={listaRef} className="ficha-episodios">
          {visibles.map((episode) => {
            const activo = selectedEpisode?.episode === episode.episode;
            const visto = estaVisto(vistos, claveBase, episode);
            return (
              <div
                key={`${episode.season}-${episode.episode}`}
                className={`ficha-episodio ${activo ? "is-active" : ""} ${visto ? "is-visto" : ""}`}
              >
                {/* Dos acciones, dos elementos. Estaba todo dentro de un único
                    `<button>`, y meter el de «visto» ahí dentro habría sido un
                    botón anidado: HTML inválido, y en algunos navegadores el
                    de dentro deja de recibir el clic. */}
                <button
                  type="button"
                  data-episode
                  data-nav="row"
                  onClick={() => onSelectEpisode(episode)}
                  aria-pressed={activo}
                  className="ficha-episodio-abrir"
                >
                  <span className="ficha-episodio-arte">
                    {episode.still ? (
                      <Image src={episode.still} alt="" width={224} height={126} />
                    ) : (
                      `E${episode.episode}`
                    )}
                    <span className="ficha-episodio-play" aria-hidden="true">
                      <Play fill="currentColor" />
                    </span>
                  </span>
                  <span className="ficha-episodio-texto">
                    <strong>
                      {episode.episode}. {episode.title}
                    </strong>
                    {episode.overview && <span>{episode.overview}</span>}
                  </span>
                </button>

                <button
                  type="button"
                  data-nav="button"
                  className="ficha-episodio-visto"
                  aria-pressed={visto}
                  title={visto ? "Marcar como no visto" : "Marcar como visto"}
                  onClick={() => toggle(claveDeEpisodio(claveBase, episode))}
                >
                  <Check aria-hidden="true" />
                  <span className="sr-only">
                    {visto ? "Marcar como no visto" : "Marcar como visto"}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
