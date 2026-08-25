"use client";

import { Play, Star, Tv } from "lucide-react";
import { memo, useState } from "react";
import type { Channel } from "@/lib/types";
import { channelMark } from "@/lib/channels";

/**
 * Una fila de canal en la lista.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/livetv/LiveTvScreen.tsx (su `ChannelRow` interno)
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b):
 *   - Extraído a su propio archivo; en el origen vive dentro de la pantalla.
 *   - Sin el `IntersectionObserver` que allí dispara la carga perezosa de la
 *     guía por fila: aquí el EPG llega entero con la página, así que no hay
 *     nada que pedir al aparecer.
 *   - Añadidos el número de canal y el monograma de respaldo.
 */
function porcentaje(inicio?: number, fin?: number): number | null {
  if (!inicio || !fin || fin <= inicio) return null;
  const transcurrido = ((Date.now() - inicio) / (fin - inicio)) * 100;
  return Math.min(100, Math.max(0, transcurrido));
}

function hora(millis?: number): string {
  if (!millis) return "";
  return new Date(millis).toLocaleTimeString("es-GT", { hour: "numeric", minute: "2-digit" });
}

interface ChannelRowProps {
  channel: Channel;
  favorite: boolean;
  selected: boolean;
  onFocus: () => void;
  onPlay: () => void;
  onToggleFavorite: () => void;
}

function ChannelRowBase({
  channel,
  favorite,
  selected,
  onFocus,
  onPlay,
  onToggleFavorite,
}: ChannelRowProps) {
  const [logoFalla, setLogoFalla] = useState(false);
  const progreso = porcentaje(channel.currentStart, channel.currentEnd);
  const hayLogo = Boolean(channel.logoUrl) && !logoFalla;

  return (
    <article
      className={`livetv-row row-virtual ${selected ? "is-selected" : ""}`}
      onMouseEnter={onFocus}
      onFocus={onFocus}
    >
      <button type="button" data-nav="row" className="livetv-row-main" onClick={onPlay}>
        <span className="livetv-row-logo">
          {hayLogo ? (
            // Igual que en el resto del diseño: `<img>` plano. Las URLs de logo
            // salen de cientos de dominios de listas IPTV y `next/image` exige
            // declarar cada uno en `remotePatterns`.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={channel.logoUrl} alt="" loading="lazy" onError={() => setLogoFalla(true)} />
          ) : channel.name ? (
            <b className="livetv-row-mark">{channelMark(channel)}</b>
          ) : (
            <Tv size={20} />
          )}
        </span>

        <span className="livetv-row-copy">
          <span className="livetv-row-title">
            <strong>{channel.name}</strong>
            <i className="livetv-quality">{channel.number}</i>
          </span>

          {channel.currentProgram ? (
            <span className="livetv-row-now">
              <em>{channel.currentProgram}</em>
              {progreso !== null && (
                <span className="livetv-progress">
                  <span style={{ width: `${progreso}%` }} />
                </span>
              )}
            </span>
          ) : (
            <span className="livetv-row-now">
              <em className="is-muted">{channel.category}</em>
            </span>
          )}

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
        onClick={onToggleFavorite}
        aria-pressed={favorite}
        aria-label={favorite ? `Quitar ${channel.name} de favoritos` : `Añadir ${channel.name} a favoritos`}
      >
        <Star size={17} fill={favorite ? "currentColor" : "none"} />
      </button>
    </article>
  );
}

/** Listas de más de 500 canales: sin memoizar, cada tecleo repinta todas. */
export const ChannelRow = memo(ChannelRowBase);
