"use client";

import { Play, Star, Tv } from "lucide-react";
import { memo, useState } from "react";
import type { Channel } from "@/lib/types";
import { channelMark } from "@/lib/channels";
import { hora, porcentajeDelPrograma } from "@/lib/guia-epg";

/**
 * Una fila de canal en la lista.
 *
 * Va memoizada porque la lista llega a 7.822 filas y sin eso cada tecleo del
 * buscador repinta todas las montadas. De ahí dos decisiones que si no
 * parecerían rodeos: los tres manejadores **reciben el canal** para que el
 * padre pueda tenerlos estables —sin argumento habría que crear tres flechas
 * nuevas por fila y por render, y el `memo` no acertaría nunca—, y el estado
 * del logo roto vive en `LogoCanal` y no aquí, porque en la fila un logo que
 * falla repintaba la fila entera, barra de progreso incluida.
 */

/**
 * El logo, con su propio estado de fallo.
 *
 * `<img>` plano y no `next/image`: las URLs salen de cientos de dominios de
 * listas IPTV y `next/image` exige declarar cada uno en `remotePatterns`.
 */
const LogoCanal = memo(function LogoCanal({ canal }: { canal: Channel }) {
  const [falla, setFalla] = useState(false);

  if (canal.logoUrl && !falla) {
    return (
      // `no-referrer`: algunos CDN de logos bloquean la imagen —devolviendo
      // ellos mismos un marcador de imagen rota— cuando ven un `Referer` de
      // un dominio que no es el suyo. Sin cabecera que mirar, sirven la
      // imagen real. Medido con el logo de ABC Kids: con `Referer` ajeno,
      // 404 disfrazado de imagen; sin él, la imagen de verdad.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={canal.logoUrl}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFalla(true)}
      />
    );
  }
  if (canal.name) return <b className="livetv-row-mark">{channelMark(canal)}</b>;
  return <Tv size={20} />;
});

/** Lo que dan ahora, con la barra de cuánto lleva; o la categoría si no hay guía. */
function EnEmision({ canal }: { canal: Channel }) {
  // El reloj se lee al montar y no en un temporizador: una barra por fila son
  // hasta 120 intervalos vivos, y en una tele eso cuesta más que la precisión
  // que da.
  // eslint-disable-next-line react-hooks/purity -- el reloj decide cuánto lleva emitido
  const progreso = porcentajeDelPrograma(canal.currentStart, canal.currentEnd, Date.now());

  if (!canal.currentProgram) {
    return (
      <span className="livetv-row-now">
        <em className="is-muted">{canal.category}</em>
      </span>
    );
  }

  return (
    <span className="livetv-row-now">
      <em>{canal.currentProgram}</em>
      {progreso !== null && (
        <span
          className="livetv-progress"
          role="progressbar"
          aria-valuenow={Math.round(progreso)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${canal.currentProgram}, ${Math.round(progreso)}% emitido`}
        >
          <span style={{ width: `${progreso}%` }} />
        </span>
      )}
    </span>
  );
}

export const ChannelRow = memo(function ChannelRow({
  channel,
  favorite,
  caido,
  selected,
  onFocus,
  onPlay,
  onToggleFavorite,
}: {
  channel: Channel;
  favorite: boolean;
  /**
   * Ha dejado de responder en este aparato. Se apaga un poco y lleva una marca,
   * pero **sigue siendo pulsable**: estos canales resucitan constantemente y
   * esconder cosas en silencio ya fue un error antes. Ver `canales-caidos.ts`.
   */
  caido?: boolean;
  selected: boolean;
  onFocus: (channel: Channel) => void;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
}) {
  return (
    <article
      className={`livetv-row row-virtual ${selected ? "is-selected" : ""} ${caido ? "is-caido" : ""}`}
      onMouseEnter={() => onFocus(channel)}
      onFocus={() => onFocus(channel)}
    >
      <button
        type="button"
        data-nav="row"
        className="livetv-row-main"
        onClick={() => onPlay(channel)}
      >
        <span className="livetv-row-logo">
          <LogoCanal canal={channel} />
        </span>

        <span className="livetv-row-copy">
          <span className="livetv-row-title">
            <strong>{channel.name}</strong>
            <i className="livetv-quality">{channel.number}</i>
            {caido && (
              <i className="livetv-caido" title="No respondió las últimas veces">
                sin señal
              </i>
            )}
          </span>

          <EnEmision canal={channel} />

          {channel.nextProgram && (
            <small>
              {channel.nextStart ? `${hora(channel.nextStart)} · ` : ""}
              {channel.nextProgram}
            </small>
          )}
        </span>

        <span className="livetv-row-play">
          <Play size={16} fill="currentColor" />
        </span>
      </button>

      <button
        type="button"
        data-nav="button"
        className={`livetv-row-star ${favorite ? "is-active" : ""}`}
        onClick={() => onToggleFavorite(channel)}
        aria-pressed={favorite}
        aria-label={
          favorite
            ? `Quitar ${channel.name} de favoritos`
            : `Añadir ${channel.name} a favoritos`
        }
      >
        <Star size={17} fill={favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
});
