"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TopNav } from "@/components/shell/top-nav";
import { MediaRail } from "@/components/media/media-rail";
import { FichaColumnas } from "./ficha-columnas";
import { FichaEpisodios } from "./ficha-episodios";
import { FichaPortada } from "./ficha-portada";
import { FichaReproductor } from "./ficha-reproductor";
import type { PlaybackSource, ResolvedCatalogItem, ResolvedEpisode } from "@/lib/catalog/types";
import { NavegacionCatalogo } from "./navegacion-catalogo";
import { useAbrirTitulo } from "./catalog-row";
import { useAnotarEnCurso } from "@/hooks/use-continuar";
import { useEpisodiosVistos } from "@/hooks/use-episodios-vistos";
import { siguientePorVer } from "@/lib/episodios-vistos";
import type { ServidorStream } from "@/lib/resolvers/types";
import { claveCatalogo, type CardItem } from "@/lib/media-item";

/**
 * La ficha de un título: portada, reproductor, datos y —si es serie—
 * episodios.
 *
 * Este componente **solo decide qué se reproduce y en qué estado está la
 * pantalla**; el pintado vive en las cuatro piezas que compone. Era un único
 * componente de 388 líneas con catorce niveles de anidamiento, y el archivo
 * con peor salud de código de todo el proyecto: cada arreglo aquí obligaba a
 * leerlo entero para saber si algo más dependía de lo que se tocaba.
 *
 * El reparto es por responsabilidad, no por tamaño:
 *
 * | Pieza | De qué se ocupa |
 * |---|---|
 * | `FichaPortada` | Arte, carátula, título y datos sueltos |
 * | `FichaReproductor` | Los servidores (VidSrc/Debrid o enlace propio) |
 * | `FichaColumnas` | Sinopsis, reparto y ficha técnica |
 * | `FichaEpisodios` | Temporadas y episodios, con su navegación por mando |
 *
 * **En una serie los episodios van ANTES que sinopsis y reparto.** En un
 * teléfono, con la carátula, el reproductor, la sinopsis y doce caras de
 * reparto por delante, llegar al capítulo siguiente eran cuatro pantallazos de
 * scroll. Quien abre una serie que ya estaba viendo va a por el capítulo; la
 * sinopsis la lee quien la abre por primera vez, y esa persona ya la tiene en
 * la portada.
 */
export function TitleDetail({
  item,
  episodes,
  selectedSeason,
  enTelevisor,
  servidoresIniciales,
  recomendados,
}: {
  item: ResolvedCatalogItem;
  episodes: ResolvedEpisode[];
  selectedSeason: number;
  /** Lo decide el servidor con el `User-Agent`. Ver la página de la ficha. */
  enTelevisor: boolean;
  /**
   * Los servidores ya comprobados en el servidor, para que el primer
   * fotograma no sea el «Not Found» de un proveedor que no tiene el título.
   * Ver `lib/catalog/disponibilidad.ts`.
   */
  servidoresIniciales?: ServidorStream[];
  /**
   * «También te puede interesar», ya convertido a tarjeta en el servidor —
   * mismo motivo que `CatalogRows`: no serializar la ficha de TMDB entera por
   * cada recomendación cuando solo se pinta título, póster, año y nota.
   */
  recomendados?: CardItem[];
}) {
  const isSeries = item.mediaType === "tv";
  const abrirRecomendado = useAbrirTitulo();

  /**
   * La clave del título, la MISMA que la de su tarjeta en cualquier riel.
   *
   * De aquí cuelgan las tres memorias del aparato —progreso, episodios vistos
   * y «Seguir viendo»— y por eso se calcula una vez aquí en lugar de
   * reconstruirse en cada pieza: reconstruirla a partir del `tmdbId` es lo que
   * hacía que el reproductor guardara en `tv-125988` mientras la tarjeta
   * preguntaba por `tv-tmdb-125988`, y con eso ninguna de las tres funcionaba.
   */
  const claveBase = claveCatalogo(item);

  /**
   * Con qué episodio se abre: el primero **sin ver**, no el primero de la
   * lista. Es lo que hace que volver a una serie a medias caiga donde tocaba
   * en vez de en el piloto que ya viste hace tres semanas.
   */
  const { ids: vistos } = useEpisodiosVistos();
  const primero = useMemo(
    () => (isSeries ? siguientePorVer(vistos, claveBase, episodes) : null),
    [isSeries, vistos, claveBase, episodes],
  );

  const [elegido, setElegido] = useState<ResolvedEpisode | null>(null);
  // Lo elegido a mano manda; mientras no se elija nada, el primero sin ver. Se
  // deriva en el render en vez de copiarse a estado en un efecto: `vistos`
  // llega vacío en el primer render (localStorage solo existe tras montar) y
  // un efecto que sincronizara estado con eso reiniciaría el vídeo al llegar.
  const selectedEpisode = elegido ?? primero;

  // Qué se reproduce ahora mismo: el episodio elegido en series, el título en
  // películas. Los episodios pueden traer su propia fuente (otro doblaje).
  const activeSource: PlaybackSource = isSeries
    ? (selectedEpisode?.source ?? item.source)
    : item.source;

  /**
   * Apuntar que se está viendo esto, para que Inicio pueda ofrecer continuar.
   *
   * Se hace aquí, al abrir la ficha y al cambiar de episodio, y **no en el
   * reproductor**: el reproductor solo sabe la posición cuando el `<video>` es
   * nuestro, y en esta app casi siempre es un iframe de otro dominio. Abrir un
   * capítulo sí se sabe siempre. Ver `lib/continuar.ts`.
   */
  const anotar = useAnotarEnCurso();
  useEffect(() => {
    anotar({
      clave: claveBase,
      mediaType: item.mediaType,
      id: item.id,
      titulo: item.title,
      poster: item.poster,
      backdrop: item.backdrop,
      temporada: isSeries ? (selectedEpisode?.season ?? selectedSeason) : undefined,
      episodio: isSeries ? selectedEpisode?.episode : undefined,
      tituloEpisodio: isSeries ? selectedEpisode?.title : undefined,
    });
  }, [anotar, claveBase, item, isSeries, selectedEpisode, selectedSeason]);

  /**
   * Modo cine: el reproductor ocupa la pantalla entera, como un canal en
   * vivo, en vez de compartir sitio con la carátula. Solo arranca activado
   * en el cascarón de un televisor —`enTelevisor` lo decide el servidor con
   * el User-Agent, ver la página de la ficha—; en un navegador normal nunca
   * se enciende y esta ficha se ve exactamente como siempre.
   *
   * Es un estado, no una ruta: `FichaReproductor` sigue montado en el mismo
   * sitio del árbol al entrar y salir, así que el vídeo no se reinicia.
   */
  const [modoCine, setModoCine] = useState(enTelevisor);
  const salirDelCine = useCallback(() => setModoCine(false), []);

  const elegirEpisodio = useCallback(
    (episode: ResolvedEpisode) => {
      setElegido(episode);
      // Elegir otro episodio en TV vuelve a llenar la pantalla con él: es la
      // misma acción que abrir el título la primera vez.
      if (enTelevisor) setModoCine(true);
    },
    [enTelevisor],
  );

  return (
    /* El mando: la ficha también vive fuera del shell. Ver
       `navegacion-catalogo.tsx`. En modo cine, Atrás cierra el reproductor
       grande en vez de saltar a Inicio — es `salirDelCine`, no el `onBack`
       de siempre. */
    <NavegacionCatalogo subirAlAbrir onBack={modoCine ? salirDelCine : undefined}>
    <div className="app-shell">
      {!modoCine && <TopNav />}

      {!modoCine && (
        <FichaPortada
          item={item}
          isSeries={isSeries}
          minutos={formatearDuracion(item.duracion)}
          /* El atajo a los capítulos vive en la portada, que es lo primero que
             se ve: sin él, en un teléfono había que pasar el reproductor
             entero para saber siquiera que la lista existía. */
          episodioActual={
            isSeries && selectedEpisode
              ? { temporada: selectedEpisode.season, episodio: selectedEpisode.episode }
              : null
          }
        />
      )}

      <div className={modoCine ? "ficha-cine" : "ficha-reproductor-slot"}>
        <FichaReproductor
          fuente={activeSource}
          titulo={item.title}
          claveBase={claveBase}
          tmdbId={item.tmdbId ?? null}
          mediaType={item.mediaType}
          temporada={selectedEpisode?.season ?? selectedSeason}
          episodio={selectedEpisode?.episode ?? 1}
          enTelevisor={enTelevisor}
          servidoresIniciales={servidoresIniciales}
          /**
           * Si se rodó en español, el audio se oye en español sin depender de
           * doblajes. Es lo único que se puede afirmar: ningún proveedor
           * publica qué pistas de audio tiene, así que para el resto solo se
           * promete subtítulo.
           */
          spokenInSpanish={item.originalLanguage === "es"}
        />

        {/* Con ratón o con el dedo, Atrás no existe: sin este botón, salir
            del modo cine solo funcionaría con un mando. */}
        {modoCine && (
          <button
            type="button"
            data-nav="button"
            className="ficha-cine-salir"
            onClick={salirDelCine}
          >
            <ArrowLeft aria-hidden="true" />
            Volver a la ficha
          </button>
        )}
      </div>

      {!modoCine && (
        <div className="ficha-cuerpo">
          {isSeries && (
            <FichaEpisodios
              item={item}
              claveBase={claveBase}
              episodes={episodes}
              selectedSeason={selectedSeason}
              selectedEpisode={selectedEpisode}
              onSelectEpisode={elegirEpisodio}
            />
          )}

          <FichaColumnas item={item} isSeries={isSeries} minutos={formatearDuracion(item.duracion)} />
        </div>
      )}

      {/* Fuera de `.ficha-cuerpo` y no dentro: ese contenedor ya pone su
          propio `--margen` como padding, y `.rail` pone el suyo — anidados,
          el carril habría quedado con el doble de sangría a la izquierda que
          el resto de la ficha. Directo en `.app-shell`, como en Inicio y en
          el catálogo. `MediaRail` no se anuncia sola cuando TMDB no tiene
          ninguna recomendación para este título. */}
      {!modoCine && (
        <MediaRail
          title="También te puede interesar"
          items={recomendados ?? []}
          onOpen={abrirRecomendado}
          posterMode
        />
      )}
    </div>
    </NavegacionCatalogo>
  );
}

/** «2 h 5 min», que es como se dice una duración, y no «125». */
function formatearDuracion(minutos: number | null): string | null {
  if (!minutos) return null;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}
