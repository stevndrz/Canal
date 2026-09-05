"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bookmark, BookmarkCheck, Film, ListVideo, Star } from "lucide-react";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";
import { claveCatalogo } from "@/lib/media-item";
import { useWatchlist } from "@/hooks/use-watchlist";

/**
 * La cabecera de una ficha: arte de fondo, carátula, título y acciones.
 *
 * **Las acciones ya no son píldoras de texto en una fila que envuelve.** Lo
 * fueron, y era un fallo de forma, no de tamaño: una píldora mide lo que mida
 * su etiqueta, así que «Volver al catálogo» + «Añadir a mi lista» + «Ver
 * tráiler» + «Capítulos · T1 E1» no caben en 393px por mucho que se encojan.
 * Se partían en tres líneas apiladas que se comían el hero entero, empujaban
 * la carátula y el título fuera del primer pantallazo y dejaban el reproductor
 * sin sitio. Apretar la píldora no arreglaba eso; solo lo retrasaba hasta el
 * siguiente título largo.
 *
 * Ahora cada acción es un icono redondo con su etiqueta debajo, de **ancho
 * fijo**: tres caben siempre en una línea, midan lo que midan sus palabras, en
 * un teléfono y en un televisor. Es el mismo patrón que usan las fichas de
 * Apple TV, y es la razón por la que allí nunca se descoloca.
 *
 * «Volver» sale de esa fila y pasa a ser un botón redondo flotando sobre el
 * arte, arriba a la izquierda: no es una acción sobre el título —es salir— y
 * mezclarlo con las otras tres lo hacía competir con ellas por el ancho.
 *
 * Y las acciones van DEBAJO del título, no encima. Lo primero que tiene que
 * leerse al abrir una ficha es qué es esto.
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
   * En qué capítulo está la ficha ahora mismo, si es una serie. Etiqueta el
   * atajo a la lista con «T1 E4», que dice a la vez que hay capítulos y por
   * dónde vas.
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
        <Link href="/peliculas" data-nav="button" className="ficha-volver" aria-label="Volver al catálogo">
          <ArrowLeft aria-hidden="true" />
        </Link>

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

            {/* Texto separado por puntos y no píldoras: tres géneros en píldora
                son tres cajas más compitiendo con el título en una pantalla
                donde ya hay carátula, datos y acciones. Aquí informan sin
                pedir que los mires. */}
            {item.generos.length > 0 && (
              <p className="ficha-generos">{item.generos.join(" · ")}</p>
            )}
          </div>
        </div>

        <div className="ficha-acciones">
          {/* Un ancla, no un botón: la lista está en la misma página y el
              navegador ya sabe llevarte a un `id`. Sin JavaScript, sin
              `scrollIntoView` y con Atrás funcionando. */}
          {isSeries && (
            <a href="#episodios" data-nav="button" className="ficha-accion">
              <span className="ficha-accion-icono">
                <ListVideo aria-hidden="true" />
              </span>
              {episodioActual
                ? `T${episodioActual.temporada} E${episodioActual.episodio}`
                : "Capítulos"}
            </a>
          )}

          <button
            type="button"
            data-nav="button"
            className={`ficha-accion ${enLista ? "is-activa" : ""}`}
            onClick={() => toggle(clave)}
            aria-pressed={enLista}
          >
            <span className="ficha-accion-icono">
              {enLista ? (
                <BookmarkCheck aria-hidden="true" fill="currentColor" />
              ) : (
                <Bookmark aria-hidden="true" />
              )}
            </span>
            {enLista ? "En mi lista" : "Mi lista"}
          </button>

          {item.trailerUrl && (
            <a
              href={item.trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ficha-accion"
              data-nav="button"
            >
              <span className="ficha-accion-icono">
                <Film aria-hidden="true" />
              </span>
              Tráiler
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
