"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Carril horizontal con flechas que solo aparecen cuando hay a dónde ir.
 *
 * Dos modos con la misma mecánica y distinta piel: el de canales pinta las
 * flechas a los lados con clases del armazón, y el de pósters las flota encima
 * del propio carrusel. Comparten `Flecha` y `useDesplazamiento` — estaban
 * escritos dos veces, y cualquier arreglo había que hacerlo en los dos.
 *
 * **Las flechas no llevan `data-nav`.** En un televisor el carril se recorre
 * moviendo el foco de tarjeta en tarjeta y el desplazamiento sigue al foco;
 * son para el ratón y para el táctil que no descubre el arrastre.
 */

/** Margen para no encender una flecha por un píxel de resto. */
const HOLGURA = 6;

/** Cuánto avanza cada pulsación: casi una pantalla, con un mínimo utilizable. */
function pasoDe(node: HTMLElement): number {
  return Math.max(220, node.clientWidth * 0.82);
}

/** Si hay recorrido a cada lado, y cómo recorrerlo. */
function useDesplazamiento(hijos: ReactNode) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [puedeAntes, setPuedeAntes] = useState(false);
  const [puedeDespues, setPuedeDespues] = useState(false);

  const medir = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    setPuedeAntes(node.scrollLeft > HOLGURA);
    setPuedeDespues(node.scrollLeft < node.scrollWidth - node.clientWidth - HOLGURA);
  }, []);

  const desplazar = useCallback((sentido: -1 | 1) => {
    const node = ref.current;
    if (node) node.scrollBy({ left: sentido * pasoDe(node), behavior: "smooth" });
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    medir();
    node.addEventListener("scroll", medir, { passive: true });

    /**
     * `ResizeObserver` existe desde Chromium 64 y el hardware al que apunta esta
     * app es MÁS VIEJO: Tizen 4.0 trae Chromium 56 y webOS 4.x, 53. Ahí
     * `new ResizeObserver(...)` lanza dentro del efecto, la excepción sube por
     * el árbol y **se cae el render de cada riel** — la portada entera en negro.
     *
     * El respaldo con `resize` de ventana no ve que el carril cambie de tamaño
     * por su cuenta, pero cubre el caso real —girar un televisor no existe— y
     * sobre todo no tumba nada.
     */
    const observador = typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    if (observador) observador.observe(node);
    else window.addEventListener("resize", medir);

    // Las imágenes llegan después del primer render y cambian el ancho total.
    const tardio = window.setTimeout(medir, 250);

    return () => {
      window.clearTimeout(tardio);
      node.removeEventListener("scroll", medir);
      if (observador) observador.disconnect();
      else window.removeEventListener("resize", medir);
    };
  }, [medir, hijos]);

  return { ref, puedeAntes, puedeDespues, desplazar };
}

function Flecha({
  sentido,
  activa,
  etiqueta,
  className,
  onClick,
}: {
  sentido: -1 | 1;
  activa: boolean;
  etiqueta: string;
  className: string;
  onClick: () => void;
}) {
  const Icono = sentido === -1 ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      disabled={!activa}
      aria-label={`Desplazar ${etiqueta} a la ${sentido === -1 ? "izquierda" : "derecha"}`}
    >
      <Icono size={24} />
    </button>
  );
}

/**
 * Flecha flotante del modo póster.
 *
 * Sin `backdrop-blur` ni `transition-all`, por lo mismo que en `media-card`:
 * son dos por riel y en Inicio hay dieciocho.
 *
 * `[@media(hover:none)]:hidden` esconde las flechas donde se toca con el dedo.
 * `shell.css` ya tiene esa regla para `.rail-arrow` y **no servía aquí**:
 * Tailwind vive en la capa `utilities` y el armazón en `components`, así que el
 * `grid` de esta misma cadena le ganaba al `display: none`. En un teléfono
 * flotaban sobre las carátulas de los rieles de películas y en los de canales
 * no — el mismo componente comportándose de dos maneras.
 */
const FLOTANTE =
  "rail-arrow [@media(hover:none)]:hidden absolute top-1/2 z-20 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/80 text-white shadow-lg transition-[border-color,transform] duration-200 hover:scale-110 hover:border-white/30";

export function RailScroller({
  children,
  className,
  ariaLabel,
  overlay,
}: {
  children: ReactNode;
  className: string;
  ariaLabel: string;
  /** Flechas flotando sobre las fichas, para el carrusel de pósters. */
  overlay?: boolean;
}) {
  const { ref, puedeAntes, puedeDespues, desplazar } = useDesplazamiento(children);

  /* Sin `data-nav`: este div es el contenedor de scroll, no un destino. Marcarlo
     hacía que el mando lo eligiera como vecino y se atascara, porque `.focus()`
     sobre un div corriente no hace nada. */
  const pista = (
    <div ref={ref} className={className}>
      {children}
    </div>
  );

  const flechas = overlay
    ? {
        contenedor: "relative group",
        antes: `${FLOTANTE} left-2 ${puedeAntes ? "opacity-100" : "pointer-events-none opacity-0"}`,
        despues: `${FLOTANTE} right-2 ${puedeDespues ? "opacity-100" : "pointer-events-none opacity-0"}`,
      }
    : {
        contenedor: `rail-scroll-shell ${puedeAntes ? "can-prev" : ""} ${puedeDespues ? "can-next" : ""}`,
        antes: "rail-arrow rail-arrow-left",
        despues: "rail-arrow rail-arrow-right",
      };

  return (
    <div className={flechas.contenedor}>
      <Flecha
        sentido={-1}
        activa={puedeAntes}
        etiqueta={ariaLabel}
        className={flechas.antes}
        onClick={() => desplazar(-1)}
      />
      {pista}
      <Flecha
        sentido={1}
        activa={puedeDespues}
        etiqueta={ariaLabel}
        className={flechas.despues}
        onClick={() => desplazar(1)}
      />
    </div>
  );
}
