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
  /** Vive en una barra fija (navegación), no en el contenido que scrollea. */
  chrome: boolean;
}

/**
 * Un candidato tiene que poder recibir el foco de verdad: `.focus()` sobre un
 * `<div>` corriente no hace nada y no avisa, así que la navegación se atasca
 * sin un solo error en consola. Pasó al marcar con `data-nav` el contenedor de
 * scroll de un carril: ese div enorme ganaba por cercanía y el foco no salía
 * de la barra. Se comprueba aquí en vez de confiar en que no se repita.
 */
const ENFOCABLES = new Set(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "VIDEO"]);

function esEnfocable(el: HTMLElement): boolean {
  if (el.tabIndex >= 0) return true;
  return ENFOCABLES.has(el.tagName) && !el.hasAttribute("disabled");
}

function collect(root: HTMLElement): Candidate[] {
  return [...root.querySelectorAll<HTMLElement>("[data-nav]")]
    .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null && esEnfocable(el))
    .map((el) => ({
      el,
      rect: el.getBoundingClientRect(),
      chrome: el.closest("[data-nav-chrome]") !== null,
    }))
    .filter(({ rect }) => rect.width > 0 && rect.height > 0);
}

/**
 * Lo que cuesta salir del contenido para ir a una barra fija.
 *
 * Las barras de navegación no se mueven con el scroll, así que geométricamente
 * están siempre pegadas al borde: al pulsar arriba desde cualquier riel, la
 * barra superior ganaba siempre y no se podía volver al riel de encima. Con
 * esta penalización solo gana cuando de verdad no hay nada de contenido en esa
 * dirección, que es cuando se quiere ir a ella.
 */
const COSTE_CHROME = 4000;

/**
 * Navegación espacial geométrica: elige el vecino real en la dirección
 * pulsada, no el siguiente en el orden del DOM. Es lo que hace que el
 * mando se sienta como una app de TV y no como tabular en una web.
 */
function pick(
  from: DOMRect,
  candidates: Candidate[],
  dir: Dir,
  desdeChrome: boolean,
): HTMLElement | null {
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach(({ el, rect, chrome }) => {
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;

    // Debe estar realmente en esa dirección, con un umbral que evita
    // que un vecino casi alineado gane por 1px.
    const primary =
      dir === "up" ? -dy : dir === "down" ? dy : dir === "left" ? -dx : dx;
    if (primary < 12) return;

    const vertical = dir === "up" || dir === "down";

    // Izquierda y derecha no cambian de fila.
    //
    // Sin esta condición, pulsar derecha en el último botón del hero saltaba a
    // la barra de navegación: está a la derecha y arriba, y la penalización por
    // desviación no bastaba para descartarla. En una interfaz de televisor las
    // filas son horizontales, así que el eje que se recorre con izquierda y
    // derecha tiene que ser el de la fila en la que ya estás. Arriba y abajo
    // sí cambian de fila, y ahí la desviación lateral solo se penaliza: el
    // contenido es ancho y exigir la misma columna dejaría filas inalcanzables.
    if (!vertical) {
      const solape = Math.min(from.bottom, rect.bottom) - Math.max(from.top, rect.top);
      if (solape <= 0) return;
    }

    const secondary = vertical ? Math.abs(dx) : Math.abs(dy);

    // Penaliza la desviación lateral: preferimos la misma columna/fila. Y
    // salir del contenido hacia una barra fija cuesta, salvo que ya se venga
    // de una: moverse dentro de la propia barra tiene que seguir siendo libre.
    const score = primary + secondary * 2.2 + (chrome && !desdeChrome ? COSTE_CHROME : 0);
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
  /**
   * Desactiva el movimiento del foco, no la tecla Atrás.
   *
   * Durante la reproducción no queremos que las flechas muevan el foco por
   * debajo del vídeo, pero Atrás tiene que seguir funcionando: es la única
   * forma de salir con un mando, que no tiene ratón ni Tab.
   */
  enabled?: boolean;
}

export function useSpatialNav({ rootRef, onBack, onDigit, enabled = true }: SpatialNavOptions) {
  /**
   * Deja el foco en el primer elemento navegable.
   *
   * Un mando de televisor no tiene Tab: si al entrar en una pantalla no hay
   * nada enfocado, las flechas no tienen desde dónde partir y el mando no
   * responde. En ratón esto no se nota porque se pulsa directamente.
   */
  const focusFirst = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    /**
     * En una pantalla táctil, no.
     *
     * Esto existe para el mando: sin nada enfocado, las flechas no tienen
     * desde dónde partir. En un teléfono no hay flechas, y lo único que se
     * consigue es dibujar un recuadro blanco alrededor del primer destino
     * nada más abrir la app — que es exactamente lo que se veía y parecía un
     * fallo de pintado.
     *
     * Se comprueba el tipo de puntero y no el ancho: un televisor con
     * mando-puntero es «coarse» y ahí el anillo tampoco ayuda, mientras que
     * una ventana estrecha en un ordenador sí lo necesita.
     */
    if (window.matchMedia?.("(pointer: coarse)").matches) return;
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && root.contains(active) && active.hasAttribute("data-nav")) return;
    const candidates = collect(root);
    const primero = candidates[0];
    if (primero) {
      primero.el.focus({ preventScroll: true });
      scrollNearest(primero.el);
    }
  }, [rootRef]);

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
      current.closest("[data-nav-chrome]") !== null,
    );
    if (next) {
      next.focus();
      scrollNearest(next);
    }
  }, [rootRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // El input de búsqueda con teclado físico manda sobre la navegación.
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";

      /**
       * Un diálogo abierto manda sobre todo esto.
       *
       * Mientras hay un `role="dialog"` con el foco dentro, las teclas son
       * suyas: sus flechas las mueve su propia rejilla y su Atrás lo cierra.
       * Sin esta guarda pasaban las dos cosas a la vez —el foco se movía dos
       * veces por pulsación, porque el diálogo y este hook lo empujaban cada
       * uno por su lado— y Atrás cerraba el diálogo **y** salía de la sección
       * entera de un tirón. Se vio con el panel de géneros del catálogo.
       */
      if (target?.closest?.('[role="dialog"]')) return;

      // Atrás se atiende siempre, incluso con el foco desactivado: es lo que
      // saca del reproductor en un televisor. Escribiendo en un campo,
      // Retroceso borra una letra y no debe salir de la pantalla.
      const esAtras =
        BACK_KEYCODES.has(event.keyCode) ||
        event.key === "Escape" ||
        event.key === "GoBack" ||
        event.key === "BrowserBack" ||
        (event.key === "Backspace" && !typing);

      if (esAtras) {
        event.preventDefault();
        onBack?.();
        return;
      }

      if (!enabled || typing) return;

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

  return { focusIn, focusFirst };
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
