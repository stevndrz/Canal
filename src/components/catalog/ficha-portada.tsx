"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bookmark, BookmarkCheck, Film, ListVideo, Star } from "lucide-react";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";
import { claveCatalogo } from "@/lib/media-item";
import { useWatchlist } from "@/hooks/use-watchlist";

/**
 * La cabecera de una ficha: arte de fondo, carátula, título y datos sueltos.
 *
 * El fondo va en este contenedor y no en un `absolute inset-0` desde y=0: así
 * arranca por debajo de la barra fija en vez de meterse detrás de ella, que
 * era lo que hacía que el título y el botón de volver se leyeran encima de la
 * navegación.
 *
 * **En un teléfono esto se reordena entero, y no solo se encoge.** Las tres
 * acciones eran tres píldoras de ancho completo que se apilaban en tres
 * líneas, la carátula caía suelta en mitad del hero y el título quedaba
 * empujado casi fuera de la primera pantalla. Aquí: «Volver» pasa a ser un
 * icono redondo, las otras dos comparten una fila que se desliza, y carátula y
 * título van uno al lado del otro. Lo hace el CSS (`@media (max-width: 680px)`
 * en `globals.css`) — el marcado es el mismo en todas las pantallas, para que
 * no haya dos versiones de la misma ficha que mantener.
 */
export function FichaPortada({
  item,
  isSeries,
  minutos,
  episodioActual,
}: {
  item: ResolvedCatalogItem;
  isSeries: boolean;
  /** Duración ya formateada; la calcula quien conoce la ficha entera. */
  minutos: string | null;
  /**
   * En qué capítulo está la ficha ahora mismo, si es una serie. Solo para
   * etiquetar el atajo a la lista: «Capítulos · T1 E4» dice a la vez que hay
   * lista y por dónde vas.
   */
  episodioActual?: { temporada: number; episodio: number } | null;
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
            {/* El texto desaparece en teléfono por CSS, no aquí: el botón
                sigue teniendo nombre accesible en todas las pantallas. */}
            <span className="ficha-volver-texto">Volver al catálogo</span>
            <span className="sr-only">Volver al catálogo</span>
          </Link>

          {/* Un ancla, no un botón: la lista está en la misma página y el
              navegador ya sabe llevarte a un `id`. Sin JavaScript, sin
              `scrollIntoView` y con Atrás funcionando. */}
          {isSeries && (
            <a href="#episodios" data-nav="button" className="secondary ficha-ir-episodios">
              <ListVideo aria-hidden="true" />
              {episodioActual
                ? `Capítulos · T${episodioActual.temporada} E${episodioActual.episodio}`
                : "Capítulos"}
            </a>
          )}

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
