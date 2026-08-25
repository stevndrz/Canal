"use client";

import { useState, type ReactNode, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, SearchX, X } from "lucide-react";
import { useBuscarTitulos } from "@/hooks/use-buscar-titulos";
import type { OrdenCatalogo } from "@/lib/catalog/discover";
import { MediaCard } from "@/components/media/media-card";
import { EstadoVacio } from "./estado-vacio";

const ORDENES: { id: OrdenCatalogo; label: string }[] = [
  { id: "populares", label: "Más populares" },
  { id: "top", label: "Mejor valoradas" },
  { id: "recientes", label: "Más recientes" },
];

/**
 * Buscador del catálogo, reactivo.
 *
 * Ya no hay botón ni envío de formulario: los resultados se actualizan
 * mientras se escribe. La petición a TMDB sigue sin salir del servidor —la
 * credencial no llega al navegador—, así que se consulta `/api/buscar`, que
 * hace de intermediaria.
 *
 * El antirrebote y la cancelación de peticiones obsoletas viven en
 * `useBuscarTitulos` (250 ms + `AbortController`): escribir «batman» cuesta
 * una petición, no seis, aunque las teclas caigan rápido.
 *
 * Mientras hay consulta activa, el contenido servido por el servidor (filas,
 * filtros) se sustituye por los resultados; al vaciar el campo vuelve sin
 * recargar nada.
 */
export function CatalogSearch({
  initialQuery = "",
  orden = "populares",
  conHero = false,
  children,
}: {
  /** Consulta previa si la URL traía `?q=`: el campo arranca ya escrita. */
  initialQuery?: string;
  /** Criterio activo del selector de orden que vive a la derecha del campo. */
  orden?: OrdenCatalogo;
  /** Hay banner encima: el bloque entra -mt-16 sobre su zona difuminada
      (h-32 fundiéndose a negro puro), cubriendo toda la costura. */
  conHero?: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(initialQuery);
  const { resultados, cargando } = useBuscarTitulos(valor);
  const campo = useRef<HTMLInputElement | null>(null);

  const buscando = valor.trim().length > 0;

  /** Borrar la búsqueda y volver al catálogo. También limpia la `?q=` de la
      URL —si venía de un enlace compartido, recargar no la resucita— sin
      tocar el resto de filtros: vuelves justo donde estabas. */
  const limpiar = () => {
    setValor("");
    campo.current?.focus();
    const params = new URLSearchParams(window.location.search);
    if (!params.has("q")) return;
    params.delete("q");
    const cadena = params.toString();
    router.replace(cadena ? `/peliculas?${cadena}` : "/peliculas", { scroll: false });
  };

  const cambiarOrden = (siguiente: OrdenCatalogo) => {
    if (siguiente === orden) return;
    const params = new URLSearchParams(window.location.search);
    if (siguiente === "populares") params.delete("orden");
    else params.set("orden", siguiente);
    params.delete("pagina");
    const cadena = params.toString();
    router.push(cadena ? `/peliculas?${cadena}` : "/peliculas");
  };

  return (
    /* Caja única FLUIDA: ocupa el ancho útil del viewport hasta 1700px.
       Buscador, orden, píldoras y carruseles comparten estos márgenes.
       Con banner encima, -mt-12 superpone esta caja sobre el degradado del
       hero: la transición imagen→fondo queda limpia, sin línea de corte. */
    <div
      className={`max-w-[1700px] w-full mx-auto px-4 sm:px-8 lg:px-12 relative z-10 space-y-6 ${
        conHero ? "-mt-16" : ""
      }`}
    >
      {/* Todo el bloque de cabecera respira centrado: buscador y orden forman
          un grupo compacto en el eje, no un campo estirado a la izquierda con
          el select colgado de la derecha. */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-center justify-center w-full">
        <form action="/peliculas" method="get" role="search" className="contents">
          <label className="catalogo-buscador-campo w-full max-w-xl">
            <span className="sr-only">Buscar películas y series</span>
            <Search aria-hidden="true" />
            <input
              ref={campo}
              type="search"
              name="q"
              data-nav="input"
              value={valor}
              onChange={(evento) => setValor(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === "Escape") limpiar();
              }}
              placeholder="Buscar película o serie…"
              autoComplete="off"
            />
            {/* Aspa discreta: solo existe mientras hay texto. Un toque borra
                la búsqueda y devuelve el catálogo general. */}
            {buscando && (
              <button
                type="button"
                data-nav="button"
                onClick={limpiar}
                aria-label="Borrar búsqueda y volver al catálogo"
                title="Borrar y volver al catálogo"
                className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full text-neutral-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </label>
        </form>

        <label className="flex shrink-0 items-center gap-2 text-sm text-neutral-400">
          Ordenar por
          <select
            value={orden}
            onChange={(evento) => cambiarOrden(evento.target.value as OrdenCatalogo)}
            aria-label="Ordenar catálogo"
            className="shrink-0 rounded-full border border-white/10 bg-neutral-800/80 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {ORDENES.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {buscando ? (
        cargando && resultados.length === 0 ? (
          <p className="catalogo-aviso" role="status">
            Buscando «{valor.trim()}»…
          </p>
        ) : resultados.length === 0 ? (
          <EstadoVacio
            Icono={SearchX}
            titulo={`Sin resultados para «${valor.trim()}»`}
            detalle="Prueba con menos palabras o con el título original."
          />
        ) : (
          <>
            <section className="section-heading">
              <h2>Resultados ({resultados.length})</h2>
            </section>
            <div className="grid-results">
              {resultados.map((item) => (
                <MediaCard
                  key={item.key}
                  item={item}
                  posterMode
                  onOpen={() => router.push(`/peliculas/${item.mediaType}/${item.id}`)}
                />
              ))}
            </div>
          </>
        )
      ) : (
        children
      )}
    </div>
  );
}
