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
  overlay,
}: {
  children: ReactNode;
  className: string;
  ariaLabel: string;
  /** Flechas flotando SIEMPRE visibles sobre las fichas (carrusel de pósters). */
  overlay?: boolean;
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

    /**
     * `ResizeObserver` existe desde Chromium 64, y el hardware al que apunta
     * esta app es MÁS VIEJO que eso: Tizen 4.0 (2018) trae Chromium 56 y
     * webOS 4.x, 53. Ahí `new ResizeObserver(...)` lanza dentro del efecto, la
     * excepción sube por el árbol y **se cae el render de cada `MediaRail`**,
     * o sea, la portada entera en negro.
     *
     * `live-tv-view.tsx` ya comprueba el soporte de `IntersectionObserver` de
     * esta misma manera; aquí faltaba. El respaldo con `resize` de ventana no
     * detecta que el carril cambie de tamaño sin que lo haga la ventana, pero
     * cubre el caso real —girar el televisor no existe— y, sobre todo, no
     * tumba nada.
     */
    const observador =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (observador) observador.observe(node);
    else window.addEventListener("resize", onScroll);

    const timer = window.setTimeout(update, 250);
    return () => {
      window.clearTimeout(timer);
      node.removeEventListener("scroll", onScroll);
      if (observador) observador.disconnect();
      else window.removeEventListener("resize", onScroll);
    };
  }, [update, children]);

  // Modo overlay: el shell es `relative group` y las flechas se pintan por
  // encima del carril con z-20, ancladas a 8px del borde — sin salirse nunca
  // del propio carrusel. Las clases Tailwind van aparte de `.rail-arrow` para
  // no alterar el comportamiento de los rieles de canales.
  if (overlay) {
    const flecha =
      "absolute top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 hover:border-white/30";
    return (
      <div className="relative group">
        <button
          type="button"
          className={`${flecha} left-2 ${canPrev ? "opacity-100" : "pointer-events-none opacity-0"}`}
          onClick={() => scrollByPage(-1)}
          disabled={!canPrev}
          aria-label={`Desplazar ${ariaLabel} a la izquierda`}
        >
          <ChevronLeft size={24} />
        </button>
        <div ref={ref} className={className}>
          {children}
        </div>
        <button
          type="button"
          className={`${flecha} right-2 ${canNext ? "opacity-100" : "pointer-events-none opacity-0"}`}
          onClick={() => scrollByPage(1)}
          disabled={!canNext}
          aria-label={`Desplazar ${ariaLabel} a la derecha`}
        >
          <ChevronRight size={24} />
        </button>
      </div>
    );
  }

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
