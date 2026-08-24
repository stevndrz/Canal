"use client";

import { useState } from "react";
import { TopNav } from "@/components/shell/top-nav";
import { normalizeRoomId } from "@/lib/watch-party/sign";
import { FichaColumnas } from "./ficha-columnas";
import { FichaEpisodios } from "./ficha-episodios";
import { FichaPortada } from "./ficha-portada";
import { FichaReproductor } from "./ficha-reproductor";
import type { PlaybackSource, ResolvedCatalogItem, ResolvedEpisode } from "@/lib/catalog/types";

/**
 * La ficha de un título: portada, reproductor, datos y —si es serie—
 * episodios.
 *
 * Este componente **solo decide qué se reproduce y en qué estado está la
 * pantalla**; el pintado vive en las cuatro piezas que compone. Era un único
 * componente de 388 líneas con catorce niveles de anidamiento, y el archivo
 * con peor salud de código de todo el proyecto: cada arreglo aquí obligaba a
 * leerlo entero para saber si algo más dependía de lo que se tocaba.
 *
 * El reparto es por responsabilidad, no por tamaño:
 *
 * | Pieza | De qué se ocupa |
 * |---|---|
 * | `FichaPortada` | Arte, carátula, título y datos sueltos |
 * | `FichaReproductor` | Los servidores (VidSrc/Debrid o enlace propio), y Ver en familia |
 * | `FichaColumnas` | Sinopsis, reparto y ficha técnica |
 * | `FichaEpisodios` | Temporadas y episodios, con su navegación por mando |
 */
export function TitleDetail({
  item,
  episodes,
  selectedSeason,
}: {
  item: ResolvedCatalogItem;
  episodes: ResolvedEpisode[];
  selectedSeason: number;
}) {
  const isSeries = item.mediaType === "tv";
  const [selectedEpisode, setSelectedEpisode] = useState<ResolvedEpisode | null>(
    isSeries ? (episodes[0] ?? null) : null,
  );
  const [sala, setSala] = useState("");
  const [salaActiva, setSalaActiva] = useState("");

  // Qué se reproduce ahora mismo: el episodio elegido en series, el título en
  // películas. Los episodios pueden traer su propia fuente (otro doblaje).
  const activeSource: PlaybackSource = isSeries
    ? (selectedEpisode?.source ?? item.source)
    : item.source;

  return (
    <div className="app-shell">
      <TopNav />

      <FichaPortada item={item} isSeries={isSeries} minutos={formatearDuracion(item.duracion)} />

      <div className="ficha-cuerpo">
        <FichaReproductor
          fuente={activeSource}
          titulo={item.title}
          tmdbId={item.tmdbId ?? null}
          mediaType={item.mediaType}
          temporada={selectedSeason}
          episodio={selectedEpisode?.episode ?? 1}
          /**
           * Si se rodó en español, el audio se oye en español sin depender de
           * doblajes. Es lo único que se puede afirmar: ningún proveedor
           * publica qué pistas de audio tiene, así que para el resto solo se
           * promete subtítulo.
           */
          spokenInSpanish={item.originalLanguage === "es"}
          sala={sala}
          salaActiva={salaActiva}
          onSalaChange={setSala}
          onEntrarSala={() => setSalaActiva(normalizeRoomId(sala))}
        />

        <FichaColumnas item={item} isSeries={isSeries} minutos={formatearDuracion(item.duracion)} />

        {isSeries && (
          <FichaEpisodios
            item={item}
            episodes={episodes}
            selectedSeason={selectedSeason}
            selectedEpisode={selectedEpisode}
            onSelectEpisode={setSelectedEpisode}
          />
        )}
      </div>
    </div>
  );
}

/** «2 h 5 min», que es como se dice una duración, y no «125». */
function formatearDuracion(minutos: number | null): string | null {
  if (!minutos) return null;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}
