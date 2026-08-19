"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronUp, X } from "lucide-react";

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
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  /** Espejo de `docked` legible desde el observador, sin re-suscribirlo. */
  const dockedRef = useRef(false);
  const [docked, setDocked] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [placeholderHeight, setPlaceholderHeight] = useState(0);

  // El centinela va justo encima del reproductor: cuando sale por arriba de la
  // pantalla, el reproductor pasa a miniatura.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldDock = !entry.isIntersecting && entry.boundingClientRect.top < 0;

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
      { threshold: 0 }
    );
    observer.observe(sentinel);
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
    <>
      <div ref={sentinelRef} aria-hidden="true" />

      {/* Hueco que ocupa el reproductor mientras está en miniatura */}
      {isDocked && placeholderHeight > 0 && (
        <div aria-hidden="true" style={{ height: placeholderHeight }} />
      )}

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
    </>
  );
}
