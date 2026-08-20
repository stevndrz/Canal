"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { Channel } from "@/lib/types";
import { TvKeyboard } from "@/components/tv-keyboard";
import { channelToCard, type CardItem } from "@/lib/media-item";
import { MediaCard } from "@/components/media/media-card";
import { useBuscarTitulos } from "@/hooks/use-buscar-titulos";

/**
 * Buscar, en los dos catálogos a la vez.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/search/SearchScreen.tsx
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b):
 *   - Se conserva el teclado en pantalla de CanalCasa, que ARVIO no tiene. En
 *     un televisor sin teclado físico, un campo de texto a secas es un
 *     callejón sin salida: el mando solo mueve el foco.
 *   - Busca en **dos** orígenes y no en uno. Antes solo recorría la lista M3U,
 *     así que escribir el nombre de una película no daba nada aunque estuviera
 *     en el catálogo: media aplicación quedaba fuera del buscador.
 *
 * Los dos orígenes se consultan de forma distinta a propósito. Los canales ya
 * están enteros en el cliente desde la primera carga, así que se filtran en
 * memoria y responden en la misma pulsación. Las películas viven en TMDB y
 * pasan por `/api/buscar`, con antirrebote: la credencial no sale al
 * navegador, así que el cliente no puede preguntarle a TMDB directamente.
 */
interface BuscarViewProps {
  results: Channel[];
  search: string;
  onSearchChange: (value: string) => void;
  onTune: (channel: Channel) => void;
}

export function BuscarView({ results, search, onSearchChange, onTune }: BuscarViewProps) {
  const router = useRouter();
  const { resultados: titulos, cargando } = useBuscarTitulos(search);

  const tarjetasCanal = results.map((channel) => channelToCard(channel));

  const abrirCanal = (card: CardItem) => {
    const canal = results.find((channel) => `canal-${channel.id}` === card.key);
    if (canal) onTune(canal);
  };

  const buscando = search.trim().length > 0;
  const totalCanales = results.length;
  const totalTitulos = titulos.length;
  const sinNada = buscando && !cargando && totalCanales === 0 && totalTitulos === 0;

  return (
    <div className="screen has-search-hero">
      <section className="search-hero">
        <span className="search-icon-shell">
          <Search size={28} />
        </span>
        <input
          type="search"
          data-nav="input"
          value={search}
          autoFocus
          onChange={(evento) => onSearchChange(evento.target.value)}
          placeholder="Buscar canales, películas y series"
          aria-label="Buscar canales, películas y series"
        />
      </section>

      {/* Teclado a un lado y resultados al otro. Puestos uno debajo del otro,
          el teclado de televisor mide más de 500px de alto y empuja los
          resultados fuera de la pantalla: escribes a ciegas. */}
      <div className="buscar-cuerpo">
        <div className="buscar-teclado">
          <TvKeyboard
            onKey={(char) => onSearchChange(search + char)}
            onBackspace={() => onSearchChange(search.slice(0, -1))}
            onClear={() => onSearchChange("")}
          />
        </div>

        <div className="buscar-resultados">
          {sinNada ? (
            <p className="buscar-vacio">
              Nada coincide con «{search}», ni en los canales ni en el catálogo.
            </p>
          ) : (
            <>
              {/* Los canales primero: son la prioridad del producto, y además
                  los únicos que responden al instante. */}
              {totalCanales > 0 && (
                <section className="buscar-grupo">
                  <p className="buscar-recuento">
                    {buscando ? `Canales · ${totalCanales}` : "Canales sugeridos"}
                  </p>
                  <div className="grid-results is-embedded">
                    {tarjetasCanal.map((item) => (
                      <MediaCard key={item.key} item={item} onOpen={abrirCanal} posterMode />
                    ))}
                  </div>
                </section>
              )}

              {(totalTitulos > 0 || cargando) && (
                <section className="buscar-grupo">
                  <p className="buscar-recuento">
                    Películas y series {cargando ? "· buscando…" : `· ${totalTitulos}`}
                  </p>
                  <div className="grid-results is-embedded">
                    {titulos.map((item) => (
                      <MediaCard
                        key={item.key}
                        item={item}
                        posterMode
                        onOpen={() => router.push(`/peliculas/${item.mediaType}/${item.id}`)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
