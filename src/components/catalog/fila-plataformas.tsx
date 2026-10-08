import Link from "next/link";
import { RailScroller } from "@/components/media/rail-scroller";
import { tmdbImage } from "@/lib/catalog/tmdb";
import type { Plataforma } from "@/lib/catalog/plataformas";

/**
 * «Explorar por plataforma»: Netflix, Prime Video, Disney+… con su logo.
 *
 * Es la pregunta que la familia se hace de verdad —«¿qué hay en Netflix?»—, y
 * hasta ahora solo se podía contestar título a título. Cada logo es un enlace
 * (`?plataforma=8`) que filtra el catálogo por lo que esa plataforma tiene en
 * Guatemala; el elegido queda marcado y tocarlo otra vez lo quita.
 *
 * Usa el mismo esqueleto que los rieles (`.rail`, `RailScroller`), así que
 * margen, desplazamiento lateral y mando son los de todas las filas. Las
 * medidas de la ficha viven en `catalogo.css` (`.plataforma`).
 */
export function FilaPlataformas({
  plataformas,
  activa,
  hrefDe,
}: {
  plataformas: Plataforma[];
  activa: number | null;
  /** URL con esa plataforma elegida (o sin ninguna, con `null`). */
  hrefDe: (id: number | null) => string;
}) {
  return (
    <section className="rail rail-plataformas">
      <div className="rail-head">
        <h3>Explorar por plataforma</h3>
      </div>
      <RailScroller className="rail-strip" ariaLabel="Plataformas">
        {plataformas.map((p) => {
          const elegida = p.id === activa;
          return (
            <Link
              key={p.id}
              data-nav="tile"
              href={hrefDe(elegida ? null : p.id)}
              aria-current={elegida ? "true" : undefined}
              aria-label={elegida ? `${p.nombre}: elegida. Pulsa para ver todo el catálogo` : `Ver lo que hay en ${p.nombre}`}
              className={`plataforma ${elegida ? "is-elegida" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- logo de TMDB ya dimensionado (w154) */}
              <img src={tmdbImage(p.logo, "w154") ?? ""} alt="" loading="lazy" decoding="async" />
              <span className="plataforma-nombre">{p.nombre}</span>
            </Link>
          );
        })}
      </RailScroller>
    </section>
  );
}
