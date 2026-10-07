"use client";

import { useMemo, useCallback } from "react";
import type { Channel } from "@/lib/types";
import type { FilaDeTarjetas } from "@/components/catalog/catalog-row";
import { channelToCard, conProgreso, enCursoACard, type CardItem } from "@/lib/media-item";
import { useProgreso } from "@/hooks/use-progreso";
import { useContinuar } from "@/hooks/use-continuar";
import { QUE_SE_PINTA, recuentosDeLista } from "@/lib/canales-empaquetados";
import { publicConfig } from "@/lib/config";
import { claveDeTema } from "@/lib/temas";
import {
  claveDeRecuento,
  fichaDe,
  normalizarCasa,
  rielesDeInicio,
  type RielDeInicio,
} from "@/lib/secciones-canales";
import { MediaRail } from "@/components/media/media-rail";
import { FilaCasa } from "./fila-casa";

interface HomeViewProps {
  channels: Channel[];
  tuned: Channel | null;
  favorites: Set<number>;
  recents: Channel[];
  /**
   * Los canales que se ven de cajón, con su propio riel el primero de todos.
   *
   * Es lo que resuelve «que estén en la tele, en mi PC y en el teléfono de mi
   * mamá» sin sincronizar nada: se configuran una vez en el despliegue y
   * aparecen igual en todos los aparatos. Ver `publicConfig.canalesDeCasa`.
   */
  deLaCasa: Channel[];
  catalog: FilaDeTarjetas[];
  /** Sintonizar sin salir de Inicio: cambia el canal de la tarjeta de arriba. */
  onSelect: (channel: Channel) => void;
  onOpenTitle: (mediaType: string, id: string) => void;
  /** El shell ya pintó la señal en directo encima; no repetir el hueco. */
  sinHueco?: boolean;
}

/**
 * Cuántos rieles de canales se ofrecen antes de mandar a Canales, y cuántos
 * canales lleva cada uno.
 *
 * Salen de `QUE_SE_PINTA` porque **son también los canales que el servidor
 * manda en el HTML**: el recorte de la portada se calcula con estos dos
 * números, así que subirlos aquí sin subirlos allí dejaría rieles a medias
 * hasta que llegara el resto de la lista.
 */
const MAX_GRUPOS = QUE_SE_PINTA.grupos;
const MAX_POR_RIEL = QUE_SE_PINTA.porGrupo;

/**
 * Inicio: la señal en directo arriba, y todo lo demás debajo.
 *
 * El orden es la decisión de producto de esta pantalla. Antes abría con una
 * cabecera de película a pantalla completa, como las apps que van de
 * películas. CanalCasa va de televisión en vivo: al entrar tiene que
 * haber señal, y el catálogo es una sección más, no la portada.
 *
 * La pantalla completa deja de ser la puerta de entrada y pasa a ser una
 * decisión: doble clic en la tarjeta, Enter con el mando, o el botón.
 */
export function HomeView({
  channels,
  tuned,
  favorites,
  recents,
  deLaCasa,
  catalog,
  onSelect,
  onOpenTitle,
  sinHueco,
}: HomeViewProps) {
  const favoriteChannels = useMemo(
    () => channels.filter((channel) => favorites.has(channel.id)),
    [channels, favorites],
  );

  /**
   * Los rieles de canales: Guatemala, los vecinos y lo que más se busca por
   * tema (ver `RIELES_DE_INICIO`). Se ordenan con las mismas funciones que
   * usa el servidor para decidir qué canales viajan en el HTML: si no, el
   * riel abriría con huecos hasta que llegara la lista completa.
   *
   * Antes eran las seis primeras categorías viejas, sin forma de ver más, y
   * Canal 3, Canal 7 y Guatevisión salían en «Casa» y otra vez justo debajo.
   */
  const casa = useMemo(() => normalizarCasa(publicConfig.canalesDeCasa), []);
  const grupos = useMemo(
    () => rielesDeInicio(channels, fichaDe, casa, { porRiel: MAX_POR_RIEL }).slice(0, MAX_GRUPOS),
    [channels, casa],
  );

  /* Estables con `useCallback`: `MediaCard` está memoizada, y un manejador
     nuevo por render anulaba el `memo` y repintaba las ~200 tarjetas de Inicio
     cada vez que cambiaba cualquier cosa. Medido: 121 renders de tarjeta por
     sintonizar un canal. */
  const abrirCanal = useCallback(
    (card: CardItem) => {
      const canal = channels.find((channel) => `canal-${channel.id}` === card.key);
      // Cambia lo que suena arriba; ir a pantalla completa se pide aparte.
      if (canal) onSelect(canal);
    },
    [channels, onSelect],
  );

  /**
   * El progreso de cada título, cruzado con las tarjetas que ya vinieron
   * hechas del servidor.
   *
   * Va aquí y no en `page.tsx` porque el servidor no puede saberlo: cada
   * aparato guarda lo suyo en `localStorage`. Memoizado porque recorre todas
   * las filas del catálogo y `MediaRail` compara por identidad.
   */
  const { memoria: progreso } = useProgreso();

  /**
   * «Seguir viendo» de cine y series: la serie a medias, con su «T1 E4».
   *
   * Sale de su propia memoria y no de cruzar el progreso con `catalog`, y esa
   * es toda la diferencia entre que funcione y que no. El progreso solo se
   * puede leer cuando el `<video>` es nuestro —«Mi enlace» y los servidores
   * «Directo»—, y lo que se usa a diario son iframes de otro dominio: con esa
   * fuente, esta fila estaba permanentemente vacía por mucho que se estuviera
   * viendo una serie. Ver `lib/continuar.ts`.
   */
  const { enCurso } = useContinuar();
  const continuarViendo = useMemo(
    () => enCurso.map((entrada) => enCursoACard(entrada, progreso)),
    [enCurso, progreso],
  );

  const catalogoConProgreso = useMemo(
    () =>
      catalog.map((fila) => ({
        ...fila,
        tarjetas: fila.tarjetas.map((tarjeta) => conProgreso(tarjeta, progreso)),
      })),
    [catalog, progreso],
  );

  const abrirFicha = useCallback(
    (card: CardItem) => {
      const [mediaType, ...resto] = card.key.split("-");
      onOpenTitle(mediaType, resto.join("-"));
    },
    [onOpenTitle],
  );

  /**
   * Las tarjetas, calculadas una vez.
   *
   * `channelToCard` devuelve un objeto NUEVO cada vez, así que hacer el `map`
   * dentro del JSX significaba que `MediaCard` —que está memoizada— recibía un
   * `item` distinto por identidad en cada render y volvía a pintarse aunque no
   * hubiera cambiado nada suyo. Medido: sintonizar un canal repintaba 121
   * tarjetas.
   */
  const tarjetasRecientes = useMemo(() => recents.map((c) => channelToCard(c)), [recents]);
  const tarjetasFavoritas = useMemo(
    () => favoriteChannels.map((c) => channelToCard(c)),
    [favoriteChannels],
  );
  const rielesDeCanal = useMemo(() => {
    // Los totales de la lista COMPLETA aunque `channels` sea aún el recorte
    // del HTML: «Ver los 527», no «Ver los 20». Ver `recuentosDeLista`.
    const recuentos = recuentosDeLista(channels);
    return grupos.map(({ riel, items, total }) => ({
      riel,
      total: Math.max(
        total,
        recuentos?.get(claveDeRecuento(riel.region ?? null, riel.tema ?? null)) ?? 0,
      ),
      tarjetas: items.map((c) => channelToCard(c)),
    }));
  }, [grupos, channels]);

  /**
   * «Ver los N ›» lleva a Canales con esa sección abierta (o ese tema
   * elegido). Va por la URL —`?vista=canales&seccion=…`— porque es la puerta
   * que `dashboard.tsx` ya ofrece para pedir una vista desde fuera, y con
   * `replaceState` no se recarga nada ni se apila historial. Canales lee el
   * parámetro al montar y deja la URL limpia.
   */
  const verSeccion = useCallback((riel: RielDeInicio) => {
    const destino = riel.region
      ? `seccion=${riel.region}`
      : riel.tema
        ? `tema=${claveDeTema(riel.tema)}`
        : "";
    const ir = () =>
      window.history.replaceState(null, "", `${window.location.pathname}?vista=canales&${destino}`);
    // Si la URL ya dijera «canales», el shell no vería ningún cambio: se
    // limpia primero y se pide en el fotograma siguiente.
    if (new URLSearchParams(window.location.search).get("vista") === "canales") {
      window.history.replaceState(null, "", window.location.pathname);
      window.setTimeout(ir, 0);
    } else {
      ir();
    }
  }, []);

  const tunedKey = tuned ? `canal-${tuned.id}` : null;

  return (
    /* `.screen` a secas, sin `has-section-heading`: esa clase pone el hueco
       superior a cero porque asume que la primera cosa de la pantalla es un
       encabezado. Aquí lo primero es la tarjeta en directo, y sin hueco su
       cabecera se metía debajo de la barra de navegación. */
    <div className={sinHueco ? "screen sin-hueco" : "screen"}>
      {/* No es un riel: son tres, son siempre los mismos y no va a haber un
          cuarto. Ver `fila-casa.tsx`. */}
      <FilaCasa canales={deLaCasa} tunedId={tuned?.id ?? null} onSelect={onSelect} />

      {/* Historial, no oferta: informan, no invitan. De ahí el modo compacto —
          son un buen recurso cuando hace falta y no tienen por qué ocupar
          como las secciones que sí están proponiendo algo.

          «Canales recientes» y no «Seguir viendo», que es como se llamaba:
          desde que la pantalla también ofrece continuar una serie, dos filas
          con el mismo nombre a dos dedos de distancia no se distinguían. Esta
          son canales; la otra, cine y series. */}
      <MediaRail
        compacto
        title="Canales recientes"
        items={tarjetasRecientes}
        onOpen={abrirCanal}
        activeKey={tunedKey}
      />

      {/* «Mis canales», como en Canales: lo que se marca con la estrella. */}
      <MediaRail
        compacto
        title="Mis canales"
        items={tarjetasFavoritas}
        onOpen={abrirCanal}
        count={favoriteChannels.length > 0 ? `${favoriteChannels.length}` : undefined}
        activeKey={tunedKey}
      />

      {rielesDeCanal.map(({ riel, total, tarjetas }) => (
        <MediaRail
          key={riel.clave}
          title={riel.titulo}
          items={tarjetas}
          onOpen={abrirCanal}
          count={total.toLocaleString("es-GT")}
          activeKey={tunedKey}
          verTodos={
            total > tarjetas.length
              ? { total, de: riel.titulo, onClick: () => verSeccion(riel) }
              : undefined
          }
        />
      ))}

      {/* Antes de los rieles curados: quien dejó una serie a medias entra a
          seguirla, no a que le propongan otra cosa. Va bajo el encabezado de
          «Películas y series» y no arriba del todo porque esta app abre con
          televisión en vivo — la señal manda, y esto es la primera cosa de la
          sección de catálogo, no de la pantalla. */}
      {(continuarViendo.length > 0 || catalog.length > 0) && (
        <>
          <section className="section-heading library-heading">
            <div className="library-title-block">
              <p className="eyebrow">Además de la televisión en vivo</p>
              <h2>Películas y series</h2>
            </div>
          </section>

          <MediaRail
            compacto
            title="Seguir viendo"
            items={continuarViendo}
            onOpen={abrirFicha}
            posterMode
          />

          {/* Ya vienen convertidas del servidor: ver `page.tsx`. Lo único que
              se les añade aquí es la barra de por dónde iba cada una, que solo
              se puede saber en el navegador. */}
          {catalogoConProgreso.map((fila) => (
            <MediaRail
              key={fila.title}
              title={fila.title}
              href={fila.href}
              items={fila.tarjetas}
              onOpen={abrirFicha}
              posterMode
            />
          ))}
        </>
      )}
    </div>
  );
}
