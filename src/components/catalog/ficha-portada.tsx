"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bookmark, BookmarkCheck, Film, Star } from "lucide-react";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";
import { claveCatalogo } from "@/lib/media-item";
import { useWatchlist } from "@/hooks/use-watchlist";

/**
 * La cabecera de una ficha: arte de fondo, carátula, título y datos sueltos.
 *
 * Se extrajo de `TitleDetail`, que era un solo componente de 388 líneas con
 * catorce niveles de anidamiento —el archivo con peor salud de todo el
 * proyecto según CodeScene—. Aquí no cambia nada de lo que se pinta: son las
 * mismas etiquetas y las mismas clases, movidas.
 *
 * El fondo va en este contenedor y no en un `absolute inset-0` desde y=0: así
 * arranca por debajo de la barra fija en vez de meterse detrás de ella, que
 * era lo que hacía que el título y el botón de volver se leyeran encima de la
 * navegación.
 */
export function FichaPortada({
  item,
  isSeries,
  minutos,
}: {
  item: ResolvedCatalogItem;
  isSeries: boolean;
  /** Duración ya formateada; la calcula quien conoce la ficha entera. */
  minutos: string | null;
}) {
  // «Mi lista» vive en localStorage: no se puede saber en el servidor si este
  // título ya está marcado, así que el estado se lee aquí, al montar.
  const { ids, toggle } = useWatchlist();
  const clave = claveCatalogo(item);
  const enLista = ids.has(clave);

  return (
    <div
      className="ficha-portada"
      style={item.backdrop ? { backgroundImage: `url(${item.backdrop})` } : undefined}
    >
      <div className="ficha-cabecera">
        <div className="ficha-acciones">
          <Link href="/peliculas" data-nav="button" className="ficha-volver">
            <ArrowLeft aria-hidden="true" />
            Volver al catálogo
          </Link>

          <button
            type="button"
            data-nav="button"
            className="secondary"
            onClick={() => toggle(clave)}
            aria-pressed={enLista}
          >
            {enLista ? (
              <BookmarkCheck aria-hidden="true" fill="currentColor" />
            ) : (
              <Bookmark aria-hidden="true" />
            )}
            {enLista ? "En mi lista" : "Añadir a mi lista"}
          </button>

          {item.trailerUrl && (
            <a
              href={item.trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="secondary"
              data-nav="button"
            >
              <Film aria-hidden="true" />
              Ver tráiler
            </a>
          )}
        </div>

        <div className="ficha-titular">
          {item.poster && (
            <Image
              src={item.poster}
              alt=""
              width={342}
              height={513}
              className="ficha-poster"
              priority
            />
          )}

          <div className="ficha-datos">
            <h1>{item.title}</h1>
            {item.tagline && <p className="ficha-tagline">{item.tagline}</p>}

            <div className="ficha-meta">
              {item.year && <span>{item.year}</span>}
              {minutos && <span>{minutos}</span>}
              {item.rating !== null && item.rating > 0 && (
                <span className="ficha-nota">
                  <Star aria-hidden="true" />
                  {item.rating.toFixed(1)}
                </span>
              )}
              <span className="ficha-tipo">{isSeries ? "Serie" : "Película"}</span>
            </div>

            {item.generos.length > 0 && (
              <div className="ficha-generos">
                {item.generos.map((genero) => (
                  <span key={genero}>{genero}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
