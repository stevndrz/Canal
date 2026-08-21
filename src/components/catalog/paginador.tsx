import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Paginador de catálogo: 1 · 2 · 3 … y las flechas.
 *
 * Son **enlaces** y no botones, a propósito. Cada página es una URL
 * (`?pagina=3`), así que se puede compartir, volver con Atrás y recargar sin
 * perder el sitio. Con botones y estado en el cliente, el botón Atrás del
 * navegador sacaría de Películas en lugar de retroceder una página.
 *
 * Nada se guarda: cada página se pide a TMDB cuando alguien navega a ella y se
 * descarta al salir. El catálogo son cientos de miles de fichas y almacenarlas
 * obligaría a mantenerlas al día para siempre.
 */
export function Paginador({
  pagina,
  totalPaginas,
  href,
}: {
  pagina: number;
  totalPaginas: number;
  /** Construye la URL de una página, conservando filtros y búsqueda. */
  href: (pagina: number) => string;
}) {
  if (totalPaginas <= 1) return null;

  const paginas = ventana(pagina, totalPaginas);

  return (
    <nav className="paginador" aria-label="Páginas del catálogo">
      <Link
        href={href(pagina - 1)}
        data-nav="button"
        className={`paginador-flecha ${pagina <= 1 ? "is-inerte" : ""}`}
        aria-disabled={pagina <= 1}
        // `tabIndex={-1}` además de `aria-disabled`: un enlace deshabilitado
        // sigue siendo enfocable, y con un mando eso es un salto que no hace
        // nada y parece que el aparato se colgó.
        tabIndex={pagina <= 1 ? -1 : undefined}
        aria-label="Página anterior"
      >
        <ChevronLeft aria-hidden="true" />
      </Link>

      {paginas.map((n, i) =>
        n === null ? (
          <span key={`hueco-${i}`} className="paginador-hueco" aria-hidden="true">
            …
          </span>
        ) : (
          <Link
            key={n}
            href={href(n)}
            data-nav="button"
            className={`paginador-numero ${n === pagina ? "is-active" : ""}`}
            aria-current={n === pagina ? "page" : undefined}
            aria-label={`Página ${n}`}
          >
            {n}
          </Link>
        ),
      )}

      <Link
        href={href(pagina + 1)}
        data-nav="button"
        className={`paginador-flecha ${pagina >= totalPaginas ? "is-inerte" : ""}`}
        aria-disabled={pagina >= totalPaginas}
        tabIndex={pagina >= totalPaginas ? -1 : undefined}
        aria-label="Página siguiente"
      >
        <ChevronRight aria-hidden="true" />
      </Link>
    </nav>
  );
}

/**
 * Qué números se enseñan: siempre la primera, la última, la actual y sus
 * vecinas. `null` es un hueco («…»).
 *
 * Con 500 páginas no caben todas, y una lista que cambia de longitud según
 * dónde estés hace que los botones bailen bajo el dedo. Esta ventana tiene
 * **ancho fijo**, así que «siguiente» siempre está en el mismo sitio.
 */
function ventana(actual: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const cerca = [actual - 1, actual, actual + 1].filter((n) => n > 1 && n < total);
  const numeros = new Set<number>([1, ...cerca, total]);

  // Con la actual pegada a un extremo sobra sitio del otro lado: se rellena
  // para que la fila no encoja.
  if (actual <= 3) [2, 3, 4].forEach((n) => numeros.add(n));
  if (actual >= total - 2) [total - 3, total - 2, total - 1].forEach((n) => numeros.add(n));

  const ordenados = [...numeros].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  const salida: (number | null)[] = [];
  let previo = 0;
  for (const n of ordenados) {
    if (previo && n - previo > 1) salida.push(null);
    salida.push(n);
    previo = n;
  }
  return salida;
}
