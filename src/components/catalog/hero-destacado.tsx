import Link from "next/link";
import { CalendarDays, Clock, Film, Info, Play, Star } from "lucide-react";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";
import { formatearDuracion, formatearNota } from "@/lib/catalog/formato";
import { claveCatalogo } from "@/lib/media-item";
import { fondoResponsivo } from "@/lib/catalog/imagen-tmdb";
import { BotonMiLista } from "./boton-mi-lista";

/**
 * La misma imagen de TMDB en pequeño, para el fondo ambiental. Desenfocada a
 * pantalla completa una de 300 px es indistinguible de la original, y pesa
 * 15 KB en vez de 300. Si no es de TMDB se usa tal cual.
 */
function arteAmbiental(url: string): string {
  return url.replace(/\/t\/p\/[a-z0-9]+\//, "/t/p/w300/");
}

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
 *  3. **Una acción grande y el resto en iconos.** «Ver ahora» en blanco; Mi
 *     lista, Más info y el tráiler juntos en una píldora de cristal.
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

  const duracion = formatearDuracion(item.duracion);
  const generos = item.generos?.slice(0, 2).join(" · ") || null;

  return (
    <>
      {/* El fondo de toda la página toma el color del título destacado, como
          la luz de la pantalla en una sala a oscuras. Es decoración pura:
          `aria-hidden` y sin foco. Ver `.cine-ambiente` en `catalogo.css`. */}
      {arte && (
        // El marco recorta lo que sobresale: ampliado ×8, el fondo pasaba unos
        // píxeles del borde derecho, y en el teléfono eso agrandaba la página
        // y dejaba la barra de abajo cortada. Ver `.cine-ambiente-marco`.
        <div className="cine-ambiente-marco" aria-hidden="true">
          <div className="cine-ambiente" style={{ backgroundImage: `url(${arteAmbiental(arte)})` }} />
        </div>
      )}
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
          //
          // `srcset`: el teléfono pide `w780` y no `w1280`. Ver `imagen-tmdb.ts`.
          <img className="hero-arte" {...fondoResponsivo(arte)} alt="" fetchPriority="high" />
        )}

        {/* Sin caja centrada de 1700 px: el texto arranca en `--margen`, el
          mismo borde que la cabecera y los rieles de debajo. Eran cuatro
          bordes izquierdos distintos en la misma pantalla. */}
        <div className="hero-copy">
          <h1 className="hero-titulo" id="hero-titulo">
            {item.title}
          </h1>

          {item.tagline && <p className="hero-lema">{item.tagline}</p>}

          {/* Cada dato con su icono, que se reconoce antes de leerlo: la
            estrella es la nota, el calendario el año, el reloj lo que dura. */}
          <div className="hero-datos">
            {item.rating !== null && item.rating > 0 && (
              <span
                className="hero-nota"
                aria-label={`Valoración ${formatearNota(item.rating)} sobre 10`}
              >
                <Star aria-hidden="true" fill="currentColor" />
                {formatearNota(item.rating)}
                <span className="hero-nota-de" aria-hidden="true">
                  /10
                </span>
              </span>
            )}
            {item.year && (
              <span>
                <CalendarDays aria-hidden="true" />
                {item.year}
              </span>
            )}
            {duracion && (
              <span>
                <Clock aria-hidden="true" />
                {duracion}
              </span>
            )}
            <span>{item.mediaType === "tv" ? "Serie" : "Película"}</span>
            {generos && <span>{generos}</span>}
          </div>

          {item.overview && <p className="hero-sinopsis">{item.overview}</p>}

          {/* Una acción grande y blanca —ver— y las demás juntas en una
            píldora de cristal, solo con icono: el ojo va primero al botón que
            importa. Cada icono lleva nombre para el lector de pantalla y para
            el ratón (`title`). */}
          <div className="hero-acciones">
            <Link href={ficha} className="primary" data-nav="button">
              <Play aria-hidden="true" fill="currentColor" />
              Ver ahora
            </Link>
            <div className="hero-grupo" role="group" aria-label="Más acciones">
              <BotonMiLista clave={claveCatalogo(item)} titulo={item.title} />
              <Link
                href={ficha}
                className="hero-icono"
                data-nav="button"
                aria-label={`Más información sobre «${item.title}»`}
                title="Más info"
              >
                <Info aria-hidden="true" />
              </Link>
              {/* El tráiler abre YouTube en otra pestaña: en la tele eso es
                salir de la app sin forma de volver con el mando. Allí no se
                ofrece (`.fuera-de-la-app` se oculta con `data-pantalla="tv"`). */}
              {trailerUrl && (
                <a
                  href={trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hero-icono fuera-de-la-app"
                  data-nav="button"
                  aria-label={`Ver el tráiler de «${item.title}» (abre YouTube)`}
                  title="Ver tráiler"
                >
                  <Film aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
