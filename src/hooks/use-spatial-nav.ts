"use client";

import { useCallback, useEffect } from "react";

/** Códigos de tecla de los mandos reales, además de las flechas del teclado. */
const BACK_KEYCODES = new Set([
  10009, // Samsung Tizen
  461, // LG webOS
  27, // Escape
]);

type Dir = "up" | "down" | "left" | "right";

interface Candidate {
  el: HTMLElement;
  rect: DOMRect;
}

function collect(root: HTMLElement): Candidate[] {
  return [...root.querySelectorAll<HTMLElement>("[data-nav]")]
    .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null)
    .map((el) => ({ el, rect: el.getBoundingClientRect() }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0);
}

/**
 * Navegación espacial geométrica: elige el vecino real en la dirección
 * pulsada, no el siguiente en el orden del DOM. Es lo que hace que el
 * mando se sienta como una app de TV y no como tabular en una web.
 */
function pick(from: DOMRect, candidates: Candidate[], dir: Dir) {
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach(({ el, rect }) => {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;

    // Debe estar realmente en esa dirección, con un umbral que evita
    // que un vecino casi alineado gane por 1px.
    const primary =
      dir === "up" ? -dy : dir === "down" ? dy : dir === "left" ? -dx : dx;
    if (primary < 12) return;

    const secondary = dir === "up" || dir === "down" ? Math.abs(dx) : Math.abs(dy);

    // Penaliza la desviación lateral: preferimos la misma columna/fila.
    const score = primary + secondary * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  });

  return best;
}

/** Deja el elemento a la vista sin usar scrollIntoView (mueve la ventana en Tizen). */
export function scrollNearest(el: HTMLElement) {
  let parent = el.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const scrollsY = /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight;
    const scrollsX = /(auto|scroll)/.test(style.overflowX) && parent.scrollWidth > parent.clientWidth;

    if (scrollsY || scrollsX) {
      const er = el.getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      const pad = 28;
      if (scrollsY) {
        if (er.top < pr.top + pad) parent.scrollTop += er.top - pr.top - pad;
        else if (er.bottom > pr.bottom - pad) parent.scrollTop += er.bottom - pr.bottom + pad;
      }
      if (scrollsX) {
        if (er.left < pr.left + pad) parent.scrollLeft += er.left - pr.left - pad;
        else if (er.right > pr.right - pad) parent.scrollLeft += er.right - pr.right + pad;
      }
    }
    parent = parent.parentElement;
  }
}

export interface SpatialNavOptions {
  /** Contenedor donde buscar elementos [data-nav]. */
  rootRef: React.RefObject<HTMLElement | null>;
  /** Tecla Atrás del mando (Escape / 10009 Tizen / 461 webOS). */
  onBack?: () => void;
  /** Dígito 0-9 del mando para canal directo. */
  onDigit?: (digit: string) => void;
  enabled?: boolean;
}

export function useSpatialNav({ rootRef, onBack, onDigit, enabled = true }: SpatialNavOptions) {
  const focusIn = useCallback((dir: Dir) => {
    const root = rootRef.current;
    if (!root) return;

    const candidates = collect(root);
    if (candidates.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const current = active && root.contains(active) && active.hasAttribute("data-nav") ? active : null;

    if (!current) {
      candidates[0].el.focus();
      scrollNearest(candidates[0].el);
      return;
    }

    const from = current.getBoundingClientRect();
    const next = pick(
      from,
      candidates.filter(({ el }) => el !== current),
      dir,
    );
    if (next) {
      next.focus();
      scrollNearest(next);
    }
  }, [rootRef]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // El input de búsqueda con teclado físico manda sobre la navegación.
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      if (BACK_KEYCODES.has(event.keyCode) || event.key === "Escape") {
        event.preventDefault();
        onBack?.();
        return;
      }

      if (typing) return;

      switch (event.key) {
        case "ArrowUp":
          event.preventDefault();
          focusIn("up");
          return;
        case "ArrowDown":
          event.preventDefault();
          focusIn("down");
          return;
        case "ArrowLeft":
          event.preventDefault();
          focusIn("left");
          return;
        case "ArrowRight":
          event.preventDefault();
          focusIn("right");
          return;
        default:
          break;
      }

      if (onDigit && /^[0-9]$/.test(event.key)) onDigit(event.key);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, focusIn, onBack, onDigit]);

  return { focusIn };
}

/**
 * Marca en <html> si el usuario está en mando o en puntero. Deja que el CSS
 * muestre el foco siempre en TV sin ensuciar el ratón con anillos.
 */
export function useRemoteInput() {
  useEffect(() => {
    const set = (mode: "dpad" | "pointer") => {
      document.documentElement.dataset.input = mode;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key.startsWith("Arrow") || event.key === "Enter") set("dpad");
    };
    const onPointer = () => set("pointer");

    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);
}
