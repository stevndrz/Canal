"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Carril horizontal con flechas que solo aparecen cuando hay a dónde ir.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/media/RailScroller.tsx
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b):
 *   - Textos de accesibilidad en español.
 *   - Las flechas quedan fuera de la navegación con mando: en un televisor el
 *     carril se recorre moviendo el foco de tarjeta en tarjeta, y el propio
 *     desplazamiento sigue al foco. Las flechas son para ratón y para pantallas
 *     táctiles que no descubren el arrastre.
 */
export function RailScroller({
  children,
  className,
  ariaLabel,
}: {
  children: ReactNode;
  className: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const max = node.scrollWidth - node.clientWidth;
    setCanPrev(node.scrollLeft > 6);
    setCanNext(node.scrollLeft < max - 6);
  }, []);

  const scrollByPage = (direction: -1 | 1) => {
    const node = ref.current;
    if (!node) return;
    node.scrollBy({ left: direction * Math.max(220, node.clientWidth * 0.82), behavior: "smooth" });
  };

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    update();
    const onScroll = () => update();
    node.addEventListener("scroll", onScroll, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(node);
    const timer = window.setTimeout(update, 250);
    return () => {
      window.clearTimeout(timer);
      node.removeEventListener("scroll", onScroll);
      resizeObserver.disconnect();
    };
  }, [update, children]);

  return (
    <div className={`rail-scroll-shell ${canPrev ? "can-prev" : ""} ${canNext ? "can-next" : ""}`}>
      <button
        type="button"
        className="rail-arrow rail-arrow-left"
        onClick={() => scrollByPage(-1)}
        disabled={!canPrev}
        aria-label={`Desplazar ${ariaLabel} a la izquierda`}
      >
        <ChevronLeft size={24} />
      </button>
      {/* Sin `data-nav`: este div es el contenedor de scroll, no un destino.
          Marcarlo hacía que la navegación con mando lo eligiera como vecino y
          se atascara, porque `.focus()` sobre un div corriente no hace nada. */}
      <div ref={ref} className={className}>
        {children}
      </div>
      <button
        type="button"
        className="rail-arrow rail-arrow-right"
        onClick={() => scrollByPage(1)}
        disabled={!canNext}
        aria-label={`Desplazar ${ariaLabel} a la derecha`}
      >
        <ChevronRight size={24} />
      </button>
    </div>
  );
}
