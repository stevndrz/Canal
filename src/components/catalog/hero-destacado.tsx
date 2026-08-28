import Link from "next/link";
import { Info, Play, Star } from "lucide-react";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";

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
export function HeroDestacado({ item }: { item: ResolvedCatalogItem }) {
  const arte = item.backdrop ?? item.poster;
  const ficha = `/peliculas/${item.mediaType}/${item.id}`;

  const datos = [
    item.year,
    item.mediaType === "tv" ? "Serie" : "Película",
    item.duracion ? formatearDuracion(item.duracion) : null,
    item.generos?.slice(0, 2).join(" · ") || null,
  ].filter(Boolean) as string[];

  return (
    <section
      className="hero w-full relative bg-black min-h-[70vh] flex flex-col justify-end pb-12"
      aria-labelledby="hero-titulo"
    >
      {arte && (
        // `<img>` y no `next/image`: el arte de TMDB ya viene dimensionado y
        // esta imagen es la primera que se ve, así que se pide sin diferir.
        //
        // Sin máscara y sin ninguna capa encima: **el fundido es uno solo** y
        // vive en `.hero::after` (shell.css). Aquí había una máscara en el
        // propio píxel MÁS dos degradados absolutos, y tres fundidos
        // solapados se multiplican: la foto quedaba al 30% de brillo ya en el
        // centro del hero y muerta al 80%. Multiplicar dos curvas da una
        // caída cuadrática, más brusca que cualquiera de ellas por separado,
        // y eso es justo lo que se lee como un borde recto en vez de un
        // fundido.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hero-arte" src={arte} alt="" fetchPriority="high" />
      )}

      <div className="max-w-[1700px] w-full mx-auto px-4 sm:px-8 lg:px-12">
        <div className="hero-copy relative z-10 pt-28 pb-20">
          <h1 className="hero-titulo text-3xl md:text-5xl font-extrabold max-w-2xl" id="hero-titulo">
            {item.title}
          </h1>

        {item.tagline && <p className="hero-lema">{item.tagline}</p>}

        <div className="hero-datos">
          {item.rating !== null && (
            <span className="hero-nota">
              <Star aria-hidden="true" fill="currentColor" />
              {item.rating.toFixed(1)}
            </span>
          )}
          {datos.map((dato) => (
            <span key={dato}>{dato}</span>
          ))}
        </div>

        {item.overview && (
          <p className="hero-sinopsis text-muted text-sm md:text-base max-w-xl line-clamp-3 my-3">
            {item.overview}
          </p>
        )}

        <div className="hero-acciones">
          <Link href={ficha} className="primary" data-nav="button">
            <Play aria-hidden="true" fill="currentColor" />
            Ver ahora
          </Link>
          <Link href={ficha} className="secondary" data-nav="button">
            <Info aria-hidden="true" />
            Más info
          </Link>
        </div>
        </div>
      </div>
    </section>
  );
}

/** «2 h 5 min», que es como se dice una duración, y no «125». */
function formatearDuracion(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}
