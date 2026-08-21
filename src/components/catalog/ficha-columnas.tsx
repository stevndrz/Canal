import Image from "next/image";
import type { ResolvedCatalogItem } from "@/lib/catalog/types";

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
}: {
  item: ResolvedCatalogItem;
  isSeries: boolean;
  minutos: string | null;
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

      <FichaTecnica item={item} isSeries={isSeries} minutos={minutos} />
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
}: {
  item: ResolvedCatalogItem;
  isSeries: boolean;
  minutos: string | null;
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
    datos.push({ termino: "Valoración", valor: `${item.rating.toFixed(1)} sobre 10` });
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

  if (datos.length === 0) return null;

  return (
    <aside className="ficha-tecnica">
      <h2>Ficha</h2>
      <dl>
        {datos.map(({ termino, valor }) => (
          <div key={termino}>
            <dt>{termino}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
