"use client";

import { Star, Tv } from "lucide-react";
import { memo, useState } from "react";
import type { Channel } from "@/lib/types";
import { channelMark } from "@/lib/channels";
import { nombreDePais, paisDe } from "@/lib/origenes";
import { porcentajeDelPrograma } from "@/lib/guia-epg";

/**
 * Una fila de canal en la lista.
 *
 * Va memoizada porque la lista llega a miles de filas y sin eso cada cambio
 * repinta todas las montadas. De ahí dos decisiones que si no parecerían
 * rodeos: los manejadores **reciben el canal** para que el padre pueda
 * tenerlos estables —sin argumento habría que crear flechas nuevas por fila y
 * por render, y el `memo` no acertaría nunca—, y el estado del logo roto vive
 * en `LogoCanal` y no aquí, porque un logo que falla repintaba la fila entera.
 *
 * **La fila entera es el botón.** Antes había un ▶ decorativo de 44 px a la
 * derecha que no hacía nada distinto de tocar la fila y le robaba al nombre
 * el sitio en el que se distinguen «Canal 9 Barbe TV» y «Canal 9 Bolivia». Lo
 * único aparte es la estrella, porque hace otra cosa.
 *
 * Todas las filas miden lo mismo —también con guía, con «sin señal» o con el
 * texto en «Muy grande»—: el nombre tiene sitio fijo para dos líneas y la
 * línea de detalle es una. La ventana virtual de la lista depende de ello.
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
  return <Tv size={20} aria-hidden="true" />;
});

/**
 * «Honduras · Noticias»: de dónde es y de qué va, que es lo que distingue a
 * los 29 nombres que se repiten entre países. En la sección de su propio país
 * el país sobra y se omite.
 */
export function detalleDeCanal(canal: Channel, { sinPais = false }: { sinPais?: boolean } = {}) {
  const pais = sinPais ? "" : nombreDePais(paisDe(canal));
  return pais ? `${pais} · ${canal.category}` : canal.category;
}

/** La segunda línea: lo que dan ahora si hay guía; si no, el detalle; si cayó, eso. */
function LineaDeDetalle({ canal, caido, sinPais }: { canal: Channel; caido: boolean; sinPais: boolean }) {
  if (caido) {
    return (
      <span className="livetv-row-detalle is-caido">
        <i className="livetv-caido">sin señal</i>
        <span>las últimas veces</span>
      </span>
    );
  }

  if (!canal.currentProgram) {
    return <span className="livetv-row-detalle">{detalleDeCanal(canal, { sinPais })}</span>;
  }

  // El reloj se lee al montar y no en un temporizador: una barra por fila son
  // decenas de intervalos vivos, y en una tele eso cuesta más que la precisión
  // que da.
  // eslint-disable-next-line react-hooks/purity -- el reloj decide cuánto lleva emitido
  const progreso = porcentajeDelPrograma(canal.currentStart, canal.currentEnd, Date.now());
  return (
    <span className="livetv-row-detalle is-programa">
      <span className="livetv-row-programa">{canal.currentProgram}</span>
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
  clave,
  favorite,
  caido = false,
  sonando,
  sinPais = false,
  onFocus,
  onPlay,
  onToggleFavorite,
}: {
  channel: Channel;
  /** La de la fila en la lista (`data-fila`): un canal puede salir en dos secciones. */
  clave: string;
  favorite: boolean;
  /**
   * Ha dejado de responder en este aparato. Se apaga un poco y lo dice, pero
   * **sigue siendo pulsable**: estos canales resucitan constantemente y
   * esconder cosas en silencio ya fue un error antes. Ver `canales-caidos.ts`.
   */
  caido?: boolean;
  /**
   * Es el que suena. Se marca con el punto de «en vivo» y `aria-current`, no
   * con fondo ni borde: el borde blanco es del foco, y «lo elegido» y «donde
   * estás» no pueden parecerse, o desde el sofá no se sabe cuál es cuál.
   */
  sonando: boolean;
  /** Dentro de la sección de su país, no repetir el país en cada fila. */
  sinPais?: boolean;
  onFocus: (channel: Channel) => void;
  onPlay: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
}) {
  return (
    <div
      className={`livetv-item livetv-row ${sonando ? "is-sonando" : ""} ${caido ? "is-caido" : ""}`}
      data-fila={clave}
      onMouseEnter={() => onFocus(channel)}
      onFocus={() => onFocus(channel)}
    >
      <button
        type="button"
        data-nav="row"
        className="livetv-row-main"
        onClick={() => onPlay(channel)}
        aria-current={sonando ? "true" : undefined}
      >
        {/* Sin `aria-label`: el lector lee lo mismo que se ve —número,
            nombre y detalle—, que es justo lo que distingue a un canal. */}
        <span className="livetv-row-numero">
          {sonando && (
            <span className="livetv-row-vivo">
              <span className="sr-only">Suena ahora, </span>
            </span>
          )}
          {channel.number}
        </span>

        <span className="livetv-row-logo" aria-hidden="true">
          <LogoCanal canal={channel} />
        </span>

        <span className="livetv-row-copy">
          <strong className="livetv-row-nombre">{channel.name}</strong>
          <LineaDeDetalle canal={channel} caido={caido} sinPais={sinPais} />
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
            ? `Quitar ${channel.name} de Mis canales`
            : `Añadir ${channel.name} a Mis canales`
        }
      >
        <Star aria-hidden="true" fill={favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
});
