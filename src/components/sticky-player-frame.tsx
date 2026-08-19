"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronUp, X } from "lucide-react";

/**
 * Umbrales de visibilidad del reproductor para pasar a miniatura y volver.
 *
 * Encoger en cuanto asoma el borde superior resultaba molesto en televisión:
 * ahí el reproductor mide unos 790 px y bastaba bajar un poco —lo justo para
 * llegar a la primera fila de canales— para que se encogiera estando aún
 * entero en pantalla. Ahora espera a que se haya ido más de la mitad.
 */
const DOCK_VISIBILITY = 0.5;
const UNDOCK_VISIBILITY = 0.65;

/**
 * Mantiene el reproductor visible como miniatura al bajar por la guía.
 *
 * Detalle que condiciona todo el diseño: **el `<video>` nunca se desmonta ni
 * se mueve de sitio en el DOM**. Cambiar de padre a un elemento de video hace
 * que el navegador reinicie la carga, y en un stream en vivo eso significa
 * varios segundos en negro. Aquí solo cambian las clases del contenedor, así
 * que el mismo elemento sigue reproduciendo sin enterarse.
 */
export function StickyPlayerFrame({
  children,
  disabled = false,
  onExpand,
}: {
  children: ReactNode;
  /** Se desactiva en pantalla completa: ahí la miniatura no tiene sentido. */
  disabled?: boolean;
  /** Llevar de vuelta al reproductor a tamaño completo. */
  onExpand?: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  /** Espejo de `docked` legible desde el observador, sin re-suscribirlo. */
  const dockedRef = useRef(false);
  const [docked, setDocked] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState(0);

  /**
   * Encoge cuando el reproductor ya casi no se ve, no al primer píxel.
   *
   * Se observa el envoltorio y no el marco: al encoger, el marco pasa a
   * `position: fixed`, así que se quedaría clavado en la esquina y el
   * observador lo leería siempre como visible — encoger y agrandar en bucle.
   * El envoltorio nunca sale del flujo, de modo que sus medidas valen igual en
   * los dos estados.
   */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const rect = entry.boundingClientRect;
        // Cuánto del reproductor queda dentro de la ventana, de 0 a 1. Se
        // calcula a mano en vez de usar `intersectionRatio` porque ese valor
        // no distingue si lo que sobra se fue por arriba o por abajo.
        const visible =
          rect.height > 0
            ? Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)) /
              rect.height
            : 0;

        // Solo cuenta salirse por ARRIBA; que la ventana recorte el reproductor
        // por abajo no es motivo para encoger.
        //
        // Esta condición sola no basta: al abrir la app la página ya aparece
        // algo desplazada (se restaura el canal elegido), así que el borde
        // superior del reproductor puede estar unos píxeles por encima del
        // cero — que es justo lo que hacía que arrancara en miniatura. Quien
        // decide es el porcentaje visible.
        const scrolledPast = rect.top < 0;
        // La distancia entre 0.5 y 0.65 es histéresis: sin ella, quedarse
        // justo en el límite haría parpadear el reproductor con cada píxel.
        const shouldDock = dockedRef.current
          ? scrolledPast && visible < UNDOCK_VISIBILITY
          : scrolledPast && visible < DOCK_VISIBILITY;

        // Se mide SOLO en la transición a miniatura, nunca estando ya
        // encogido: con la clase `player-dock` puesta se guardaría el alto de
        // la miniatura en vez del real y el hueco reservado quedaría mal.
        if (shouldDock && !dockedRef.current && frameRef.current) {
          setPlaceholderHeight(frameRef.current.getBoundingClientRect().height);
        }
        // Al volver arriba, la miniatura queda lista para la próxima vez.
        if (!shouldDock) setDismissed(false);
        dockedRef.current = shouldDock;
        setDocked(shouldDock);
      },
      // Varios pasos para que avise mientras el reproductor se va saliendo, y
      // no solo al entrar y salir del todo.
      { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1] }
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const expand = useCallback(() => {
    onExpand?.();
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [onExpand]);

  const isDocked = docked && !disabled && !dismissed;

  return (
    // El envoltorio guarda el hueco del reproductor mientras está en
    // miniatura; así la guía no da un salto al encoger ni al volver.
    <div
      ref={wrapperRef}
      style={isDocked && placeholderHeight > 0 ? { height: placeholderHeight } : undefined}
    >
      <div ref={frameRef} className={isDocked ? "player-dock" : undefined}>
        {children}

        {isDocked && (
          <div className="absolute inset-x-0 top-0 flex justify-between gap-1 p-1.5">
            <button
              type="button"
              onClick={expand}
              aria-label="Volver al reproductor grande"
              className="rounded-lg bg-black/60 p-1.5 text-white transition hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <ChevronUp aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Ocultar miniatura"
              className="rounded-lg bg-black/60 p-1.5 text-white transition hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
