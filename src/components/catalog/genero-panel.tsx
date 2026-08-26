"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { useGridNavigation } from "@/hooks/use-grid-navigation";
import type { TmdbGenre } from "@/lib/catalog/tmdb";

/**
 * El género, detrás de un botón.
 *
 * Los géneros estaban sueltos en la cabecera y se partían en dos líneas
 * centradas. Con mando eso es lo peor de los dos mundos: veinte paradas
 * seguidas, y bajar desde «Terror» caía donde quisiera la geometría porque las
 * dos líneas no se alinean entre sí. La cabecera entera pedía unas veintiséis
 * pulsaciones antes de llegar al contenido.
 *
 * Aquí son **una** parada que dice el género activo, y una rejilla al abrirla.
 * Una rejilla es lo que `useGridNavigation` sabe recorrer —elige el vecino más
 * cercano en la dirección de la flecha, no el siguiente del DOM— y además
 * enseña los veinte a la vez, en lugar de esconder dos tercios fuera del borde
 * como hacía el carrusel.
 *
 * **Siguen siendo enlaces.** El filtro vive en la URL (`?tipo=&genero=&orden=`),
 * no en estado de cliente: se puede compartir, el botón atrás deshace y
 * funciona sin JavaScript. Lo único que aporta este componente es cuándo se
 * ven.
 */
export function GeneroPanel({
  generos,
  activo,
  hrefDe,
}: {
  generos: TmdbGenre[];
  /** El género seleccionado, o `null` para «todos». */
  activo: number | null;
  /** La URL de cada género. La arma quien nos monta, que sabe del resto de filtros. */
  hrefDe: (genero: number | null) => string;
}) {
  const [abierto, setAbierto] = useState(false);
  const disparador = useRef<HTMLButtonElement | null>(null);

  const nombre = generos.find((genero) => genero.id === activo)?.name ?? "Todos los géneros";

  const cerrar = useCallback(() => {
    setAbierto(false);
    // El foco vuelve de donde salió. Sin esto, con un mando se queda en la
    // nada y las flechas dejan de responder.
    disparador.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={disparador}
        type="button"
        data-nav="button"
        className={`catalogo-chip ${activo !== null ? "is-active" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => setAbierto((previo) => !previo)}
      >
        {nombre}
        <ChevronDown aria-hidden="true" className="catalogo-chip-flecha" />
      </button>

      {abierto && (
        <PanelAbierto
          generos={generos}
          activo={activo}
          hrefDe={hrefDe}
          onCerrar={cerrar}
          onElegir={() => setAbierto(false)}
        />
      )}
    </>
  );
}

/**
 * El panel en sí, en un componente aparte y no dentro de un `{abierto && …}`.
 *
 * No es una manía de organización: `useGridNavigation` engancha su escucha en
 * `containerRef.current` **cuando corre su efecto**, y sus dependencias son la
 * ref y el selector, que nunca cambian. Declarado en el componente de fuera,
 * ese efecto corría una vez al montar —con el panel cerrado y la ref en
 * `null`— y no volvía a correr nunca: las flechas no movían nada dentro del
 * panel. Montando el panel como componente propio, su efecto corre cuando el
 * nodo ya existe.
 */
function PanelAbierto({
  generos,
  activo,
  hrefDe,
  onCerrar,
  onElegir,
}: {
  generos: TmdbGenre[];
  activo: number | null;
  hrefDe: (genero: number | null) => string;
  onCerrar: () => void;
  onElegir: () => void;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  useGridNavigation(panel, "[data-nav]");

  useEffect(() => {
    const nodo = panel.current;

    // Al abrir, el foco entra en el género activo —o en el primero—, y no en
    // donde caiga el orden del DOM.
    const id = window.setTimeout(() => {
      const objetivo =
        nodo?.querySelector<HTMLElement>("[aria-current='true']") ??
        nodo?.querySelector<HTMLElement>("[data-nav]");
      objetivo?.focus();
    }, 30);

    /**
     * Atrás cierra el panel, y solo el panel.
     *
     * Escucha en el propio panel y no en `window`: `useSpatialNav` también
     * atiende Atrás —para salir de la sección— y si los dos lo vieran, una
     * pulsación cerraría el panel **y** saldría del catálogo de un tirón. El
     * hook se aparta solo cuando el foco está dentro de un `role="dialog"`,
     * así que basta con quedárselo aquí.
     */
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" || evento.key === "Backspace" || evento.keyCode === 10009) {
        evento.preventDefault();
        onCerrar();
      }
    };
    nodo?.addEventListener("keydown", alPulsar);

    return () => {
      window.clearTimeout(id);
      nodo?.removeEventListener("keydown", alPulsar);
    };
  }, [onCerrar]);

  return (
    <div className="genero-velo" onClick={onCerrar} role="presentation">
      <div
        ref={panel}
        className="genero-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Elegir género"
        // El clic dentro no debe cerrar; el de fuera, sí.
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="genero-panel-cabecera">
          <h2>Género</h2>
          <button
            type="button"
            data-nav="button"
            className="genero-panel-cerrar"
            aria-label="Cerrar"
            onClick={onCerrar}
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="genero-rejilla">
          <Link
            data-nav="button"
            href={hrefDe(null)}
            aria-current={activo === null ? "true" : undefined}
            className={`catalogo-chip ${activo === null ? "is-active" : ""}`}
            onClick={onElegir}
          >
            Todos los géneros
          </Link>
          {generos.map((genero) => (
            <Link
              key={genero.id}
              data-nav="button"
              href={hrefDe(genero.id)}
              aria-current={activo === genero.id ? "true" : undefined}
              className={`catalogo-chip ${activo === genero.id ? "is-active" : ""}`}
              onClick={onElegir}
            >
              {genero.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
