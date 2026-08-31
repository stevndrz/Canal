"use client";

import { useMemo, useCallback } from "react";
import type { Channel } from "@/lib/types";
import type { FilaDeTarjetas } from "@/components/catalog/catalog-row";
import { channelToCard, conProgreso, type CardItem } from "@/lib/media-item";
import { useProgreso } from "@/hooks/use-progreso";
import { groupByCategory } from "@/lib/channels";
import { QUE_SE_PINTA } from "@/lib/canales-empaquetados";
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
 * Cuántas categorías se ofrecen antes de mandar a Canales, y cuántos canales
 * lleva cada riel.
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

  const grupos = useMemo(() => groupByCategory(channels).slice(0, MAX_GRUPOS), [channels]);

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
  const rielesDeCanal = useMemo(
    () =>
      grupos.map(({ category, items }) => ({
        category,
        total: items.length,
        tarjetas: items.slice(0, MAX_POR_RIEL).map((c) => channelToCard(c)),
      })),
    [grupos],
  );

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
          como las secciones que sí están proponiendo algo. */}
      <MediaRail
        compacto
        title="Seguir viendo"
        items={tarjetasRecientes}
        onOpen={abrirCanal}
        activeKey={tunedKey}
      />

      <MediaRail
        compacto
        title="Tus favoritos"
        items={tarjetasFavoritas}
        onOpen={abrirCanal}
        count={favoriteChannels.length > 0 ? `${favoriteChannels.length}` : undefined}
        activeKey={tunedKey}
      />

      {rielesDeCanal.map(({ category, total, tarjetas }) => (
        <MediaRail
          key={category}
          title={category}
          items={tarjetas}
          onOpen={abrirCanal}
          count={`${total}`}
          activeKey={tunedKey}
        />
      ))}

      {catalog.length > 0 && (
        <>
          <section className="section-heading library-heading">
            <div className="library-title-block">
              <p className="eyebrow">Además de la televisión en vivo</p>
              <h2>Películas y series</h2>
            </div>
          </section>

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
