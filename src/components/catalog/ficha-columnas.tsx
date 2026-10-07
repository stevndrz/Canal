import Image from "next/image";
import { ExternalLink, Info } from "lucide-react";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";
import { formatearNota } from "@/lib/catalog/formato";

/** Los pocos idiomas que aparecen de verdad en este catálogo. */
const IDIOMAS: Record<string, string> = {
  es: "Español",
  en: "Inglés",
  ja: "Japonés",
  ko: "Coreano",
  fr: "Francés",
  it: "Italiano",
  pt: "Portugués",
  de: "Alemán",
};

/**
 * Lo que va debajo del vídeo, en dos columnas.
 *
 * Sinopsis y reparto ocupan la ancha; la ficha técnica va al lado en vez de
 * convertirse en otra fila más de una lista vertical interminable.
 *
 * Extraído de `TitleDetail` junto con `FichaPortada`: entre las dos se llevan
 * 200 de sus 388 líneas y el anidamiento baja de catorce niveles a cinco.
 */
export function FichaColumnas({
  item,
  isSeries,
  minutos,
  enTelevisor = false,
}: {
  item: ResolvedCatalogItem;
  isSeries: boolean;
  minutos: string | null;
  /** En la tele no se enlaza a IMDB: abriría otra pestaña fuera de la app. */
  enTelevisor?: boolean;
}) {
  return (
    <div className="ficha-columnas">
      <div className="ficha-columna-principal">
        {item.overview && (
          <section className="ficha-seccion">
            <h2>Sinopsis</h2>
            <p className="ficha-sinopsis">{item.overview}</p>
          </section>
        )}

        {item.reparto.length > 0 && (
          <section className="ficha-seccion">
            <h2>Reparto</h2>
            <div className="ficha-reparto">
              {item.reparto.map((persona) => (
                <figure key={`${persona.nombre}-${persona.personaje}`} className="ficha-persona">
                  {persona.foto ? (
                    <Image src={persona.foto} alt="" width={342} height={513} />
                  ) : (
                    <span className="ficha-persona-inicial" aria-hidden="true">
                      {persona.nombre.slice(0, 1)}
                    </span>
                  )}
                  <figcaption>
                    <strong>{persona.nombre}</strong>
                    {persona.personaje && <span>{persona.personaje}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>

      <FichaTecnica item={item} isSeries={isSeries} minutos={minutos} conEnlaces={!enTelevisor} />
    </div>
  );
}

/**
 * La columna estrecha: una lista de definiciones con lo que se sabe del
 * título.
 *
 * Cada dato se omite si falta, en lugar de enseñar «Duración: —». Una ficha a
 * medias con huecos vacíos parece rota; sin ellos, simplemente es más corta.
 */
function FichaTecnica({
  item,
  isSeries,
  minutos,
  conEnlaces,
}: {
  item: ResolvedCatalogItem;
  isSeries: boolean;
  minutos: string | null;
  /** Ver `FichaColumnas.enTelevisor`. */
  conEnlaces: boolean;
}) {
  const datos: { termino: string; valor: string }[] = [];

  if (item.year) datos.push({ termino: isSeries ? "Estreno" : "Año", valor: item.year });
  if (minutos) datos.push({ termino: isSeries ? "Episodio" : "Duración", valor: minutos });
  if (item.autoria.length > 0) {
    datos.push({ termino: isSeries ? "Creación" : "Dirección", valor: item.autoria.join(", ") });
  }
  if (item.generos.length > 0) {
    datos.push({ termino: "Géneros", valor: item.generos.join(" · ") });
  }
  if (item.rating !== null && item.rating > 0) {
    datos.push({ termino: "Valoración", valor: `${formatearNota(item.rating)} sobre 10` });
  }
  if (item.originalLanguage) {
    datos.push({
      termino: "Idioma original",
      valor: IDIOMAS[item.originalLanguage] ?? item.originalLanguage.toUpperCase(),
    });
  }
  if (isSeries && item.seasons.length > 0) {
    datos.push({ termino: "Temporadas", valor: String(item.seasons.length) });
  }

  const imdb = conEnlaces ? item.imdbId : null;
  if (datos.length === 0 && !imdb) return null;

  return (
    <aside className="ficha-tecnica">
      <h2>
        <Info aria-hidden="true" />
        Ficha
      </h2>
      {datos.length > 0 && (
        <dl>
          {datos.map(({ termino, valor }) => (
            <div key={termino}>
              <dt>{termino}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* Solo cuando se sabe con certeza: `imdbId` llega vacío si TMDB no lo
          tiene, y aquí no se adivina una URL que podría llevar a otro título. */}
      {imdb && (
        <a
          href={`https://www.imdb.com/title/${imdb}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="secondary mt-3"
          data-nav="button"
        >
          <ExternalLink aria-hidden="true" />
          Ver en IMDB
        </a>
      )}
    </aside>
  );
}
