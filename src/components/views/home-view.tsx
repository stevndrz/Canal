"use client";

import { useMemo } from "react";
import type { Channel } from "@/lib/types";
import type { CatalogSection } from "@/lib/catalog/types";
import { channelToCard, catalogToCard, type CardItem } from "@/lib/media-item";
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
  catalog: CatalogSection[];
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

  const abrirCanal = (card: CardItem) => {
    const canal = channels.find((channel) => `canal-${channel.id}` === card.key);
    // Una tarjeta de canal cambia lo que suena en la tarjeta de arriba; no
    // salta a pantalla completa. Ir a pantalla completa se pide aparte.
    if (canal) onSelect(canal);
  };

  const abrirFicha = (card: CardItem) => {
    const [mediaType, ...resto] = card.key.split("-");
    onOpenTitle(mediaType, resto.join("-"));
  };

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
        items={recents.map((channel) => channelToCard(channel))}
        onOpen={abrirCanal}
        activeKey={tunedKey}
      />

      <MediaRail
        compacto
        title="Tus favoritos"
        items={favoriteChannels.map((channel) => channelToCard(channel))}
        onOpen={abrirCanal}
        count={favoriteChannels.length > 0 ? `${favoriteChannels.length}` : undefined}
        activeKey={tunedKey}
      />

      {grupos.map(({ category, items }) => (
        <MediaRail
          key={category}
          title={category}
          items={items.slice(0, MAX_POR_RIEL).map((channel) => channelToCard(channel))}
          onOpen={abrirCanal}
          count={`${items.length}`}
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

          {catalog.map((section) => (
            <MediaRail
              key={section.title}
              title={section.title}
              items={section.items.map(catalogToCard)}
              onOpen={abrirFicha}
              posterMode
            />
          ))}
        </>
      )}
    </div>
  );
}
