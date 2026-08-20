"use client";

import { Search } from "lucide-react";
import type { Channel } from "@/lib/types";
import { TvKeyboard } from "@/components/tv-keyboard";
import { channelToCard, type CardItem } from "@/lib/media-item";
import { MediaCard } from "@/components/media/media-card";

/**
 * Buscar.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/search/SearchScreen.tsx
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b): se conserva el teclado en
 * pantalla de CanalCasa, que ARVIO no tiene. En un televisor sin teclado
 * físico, un campo de texto sin más es un callejón sin salida: el mando solo
 * mueve el foco. Va debajo del campo, que es donde el pulgar del mando llega
 * después de escribir.
 */
interface BuscarViewProps {
  results: Channel[];
  search: string;
  onSearchChange: (value: string) => void;
  onTune: (channel: Channel) => void;
}

export function BuscarView({ results, search, onSearchChange, onTune }: BuscarViewProps) {
  const tarjetas = results.map((channel) => channelToCard(channel));

  const abrir = (card: CardItem) => {
    const canal = results.find((channel) => `canal-${channel.id}` === card.key);
    if (canal) onTune(canal);
  };

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
          placeholder="Buscar canales"
          aria-label="Buscar canales"
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
          <p className="buscar-recuento">
            {search
              ? `${results.length} resultado${results.length === 1 ? "" : "s"} para «${search}»`
              : "Sugeridos"}
          </p>

          <div className="grid-results is-embedded">
            {tarjetas.map((item) => (
              <MediaCard key={item.key} item={item} onOpen={abrir} posterMode />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
