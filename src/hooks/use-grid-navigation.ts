"use client";

import { useEffect, type RefObject } from "react";

/**
 * Navegación espacial por flechas, para el control remoto.
 *
 * Mueve el **foco real** del navegador en vez de llevar un índice en estado:
 * así `Enter` funciona solo, el anillo de `:focus-visible` marca dónde está el
 * usuario y los lectores de pantalla siguen la posición.
 *
 * La elección del siguiente elemento es **geométrica**, no por orden en el DOM.
 * Eso importa porque el catálogo son filas horizontales de distinta longitud:
 * contar columnas fijas fallaría en cuanto una fila tuviera tres títulos y la
 * siguiente diez. Aquí se busca, entre los elementos que están hacia donde
 * apunta la flecha, el que quede más cerca del centro del actual.
 */
export function useGridNavigation(containerRef: RefObject<HTMLElement | null>, itemSelector: string) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isArrow = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key);
      if (!isArrow && event.key !== "Home" && event.key !== "End") return;

      const items = Array.from(container.querySelectorAll<HTMLElement>(itemSelector));
      if (items.length === 0) return;

      const current = items.indexOf(document.activeElement as HTMLElement);
      if (current === -1) return; // el foco está fuera de esta zona

      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const target = items[event.key === "Home" ? 0 : items.length - 1];
        target.focus();
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }

      const center = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, height: rect.height };
      };

      const from = center(items[current]);
      const horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
      const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
      // Dos elementos están "en la misma fila" si sus centros verticales no se
      // separan más de media altura de tarjeta.
      const sameRowThreshold = from.height / 2;

      let best: HTMLElement | null = null;
      let bestScore = Number.POSITIVE_INFINITY;

      items.forEach((item, index) => {
        if (index === current) return;
        const to = center(item);
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        if (horizontal) {
          // Misma fila y hacia el lado correcto.
          if (Math.abs(dy) > sameRowThreshold) return;
          if (forward ? dx <= 0 : dx >= 0) return;
          const score = Math.abs(dx);
          if (score < bestScore) {
            bestScore = score;
            best = item;
          }
        } else {
          // Otra fila, hacia arriba o abajo; se prefiere la fila más cercana y,
          // dentro de ella, la tarjeta mejor alineada horizontalmente.
          if (Math.abs(dy) <= sameRowThreshold) return;
          if (forward ? dy <= 0 : dy >= 0) return;
          const score = Math.abs(dy) * 1000 + Math.abs(dx);
          if (score < bestScore) {
            bestScore = score;
            best = item;
          }
        }
      });

      // Sin candidato se deja pasar la tecla: permite salir de la zona hacia
      // el menú o hacia otra sección.
      if (!best) return;

      event.preventDefault();
      (best as HTMLElement).focus();
      (best as HTMLElement).scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, itemSelector]);
}
