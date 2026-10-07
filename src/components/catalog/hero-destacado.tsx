import Link from "next/link";
import { Film, Info, Play, Star } from "lucide-react";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";
import { formatearDuracion, formatearNota } from "@/lib/catalog/formato";

/**
 * La cabecera de Películas: un título a sangre, del tamaño de la pantalla.
 *
 * Es lo que separa un catálogo de una lista de archivos. Un televisor se mira
 * desde tres metros y de lejos una rejilla de carátulas pequeñas es una
 * textura, no una oferta: hace falta que algo grande diga «esto es lo que hay
 * hoy».
 *
 * Tres decisiones que sostienen el resto:
 *
 *  1. **El arte manda y el texto se apoya en él.** El degradado va de negro
 *     sólido a transparente en diagonal, no una capa gris uniforme: así el
 *     texto se lee siempre y la ilustración sigue viéndose entera.
 *  2. **El texto tiene ancho máximo.** A 1920px una sinopsis a todo lo ancho
 *     son líneas de 200 caracteres que nadie sigue con la vista.
 *  3. **Dos acciones y no cinco.** Ver ahora y Más info. Todo lo demás está a
 *     un clic dentro de la ficha.
 *
 * No rota sola. Un carrusel automático mueve el fondo mientras alguien está
 * leyendo la sinopsis, y en un mando obliga a perseguir el botón.
 */
export function HeroDestacado({
  item,
  trailerUrl,
}: {
  item: ResolvedCatalogItem;
  /**
   * Se pide aparte de `item`: las filas del catálogo no traen vídeos —ver
   * `discover.ts`—, así que quien elige al héroe lo pide solo para ese único
   * título. Sin tráiler, el botón simplemente no existe.
   */
  trailerUrl?: string | null;
}) {
  const arte = item.backdrop ?? item.poster;
  const ficha = `/peliculas/${item.mediaType}/${item.id}`;

  const datos = [
    item.year,
    item.mediaType === "tv" ? "Serie" : "Película",
    formatearDuracion(item.duracion),
    item.generos?.slice(0, 2).join(" · ") || null,
  ].filter(Boolean) as string[];

  return (
    <section className="hero" aria-labelledby="hero-titulo">
      {arte && (
        // `<img>` y no `next/image`: el arte de TMDB ya viene dimensionado y
        // esta imagen es la primera que se ve, así que se pide sin diferir.
        //
        // Sin ninguna capa encima: **el fundido es uno solo** y vive en
        // `.hero::after`. Tres fundidos solapados se multiplican y la foto
        // quedaba muerta al 80 %. El borde de abajo lo disuelve una máscara en
        // `catalogo.css`, para que el héroe acabe en transparente sobre el
        // fondo de la app en vez de en una línea recta.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hero-arte" src={arte} alt="" fetchPriority="high" />
      )}

      {/* Sin caja centrada de 1700 px: el texto arranca en `--margen`, el
          mismo borde que la cabecera y los rieles de debajo. Eran cuatro
          bordes izquierdos distintos en la misma pantalla. */}
      <div className="hero-copy">
        <h1 className="hero-titulo" id="hero-titulo">
          {item.title}
        </h1>

        {item.tagline && <p className="hero-lema">{item.tagline}</p>}

        <div className="hero-datos">
          {item.rating !== null && item.rating > 0 && (
            <span className="hero-nota" aria-label={`Valoración ${formatearNota(item.rating)} sobre 10`}>
              <Star aria-hidden="true" fill="currentColor" />
              {formatearNota(item.rating)}
            </span>
          )}
          {datos.map((dato) => (
            <span key={dato}>{dato}</span>
          ))}
        </div>

        {item.overview && <p className="hero-sinopsis">{item.overview}</p>}

        <div className="hero-acciones">
          <Link href={ficha} className="primary" data-nav="button">
            <Play aria-hidden="true" fill="currentColor" />
            Ver ahora
          </Link>
          <Link href={ficha} className="secondary" data-nav="button">
            <Info aria-hidden="true" />
            Más info
          </Link>
          {/* El tráiler abre YouTube en otra pestaña: en la tele eso es salir
              de la app sin forma de volver con el mando. Allí no se ofrece
              (`.fuera-de-la-app` se oculta con `data-pantalla="tv"`); el
              tráiler sigue a mano en el teléfono y en el PC. */}
          {trailerUrl && (
            <a
              href={trailerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="secondary fuera-de-la-app"
              data-nav="button"
            >
              <Film aria-hidden="true" />
              Ver tráiler
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
