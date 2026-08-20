"use client";

import type { Channel } from "@/lib/types";
import { groupByCategory } from "@/lib/channels";

/**
 * Categorías.
 *
 * ARVIO no tiene esta pantalla —sus categorías viven dentro de Live TV—, así
 * que aquí no hay nada que portar: lo que se adopta es su lenguaje, el mismo
 * `.section-heading` y las mismas fichas de panel que el resto de la app, para
 * que no se note el salto al entrar.
 */
interface CategoriasViewProps {
  channels: Channel[];
  onPick: (category: string) => void;
}

export function CategoriasView({ channels, onPick }: CategoriasViewProps) {
  const groups = groupByCategory(channels);

  return (
    <div className="screen has-section-heading">
      <section className="section-heading library-heading">
        <div className="library-title-block">
          <p className="eyebrow">Ordenadas como las clasifica tu lista</p>
          <h2>Categorías</h2>
        </div>
      </section>

      <div className="categoria-rejilla">
        {groups.map(({ category, items }) => (
          <button
            key={category}
            type="button"
            data-nav="tile"
            className="categoria-ficha"
            onClick={() => onPick(category)}
          >
            <strong>{category}</strong>
            <em>{items.length.toLocaleString("es-GT")} canales</em>
          </button>
        ))}
      </div>
    </div>
  );
}
