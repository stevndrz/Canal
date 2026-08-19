"use client";

import Image from "next/image";
import { useState } from "react";
import { Star } from "lucide-react";
import type { Channel } from "@/lib/types";
import { channelMark } from "@/lib/channels";

/**
 * Logo con respaldo al monograma si la imagen falla a medio cargar.
 *
 * `key={channel.logoUrl}` en el punto de uso, no aquí dentro, es lo que
 * importa: fuerza a React a montar un nodo NUEVO cada vez que cambia la URL,
 * en vez de reutilizar el mismo `<img>` con su `failed` ya en `true` de un
 * logo distinto. Sin eso, un fallo con un canal contaminaría al siguiente
 * que ocupara su lugar en la lista.
 */
function ChannelLogo({ channel }: { channel: Channel }) {
  const [failed, setFailed] = useState(false);

  if (!channel.logoUrl || failed) {
    return (
      <span className="absolute inset-0 grid place-items-center text-[28px] font-bold tracking-tight text-zinc-100/35">
        {channelMark(channel)}
      </span>
    );
  }

  return (
    <Image
      src={channel.logoUrl}
      alt=""
      fill
      unoptimized
      sizes="240px"
      className="object-contain p-5"
      onError={() => setFailed(true)}
    />
  );
}

interface ChannelTileProps {
  channel: Channel;
  isFavorite: boolean;
  isTuned?: boolean;
  onSelect: (channel: Channel) => void;
  /** Ancho fijo dentro de un riel horizontal; en cuadrícula se deja fluido. */
  width?: number;
}

export function ChannelTile({ channel, isFavorite, isTuned, onSelect, width }: ChannelTileProps) {
  return (
    <button
      type="button"
      data-nav="tile"
      data-channel-id={channel.id}
      onClick={() => onSelect(channel)}
      style={width ? { flex: `0 0 ${width}px`, width } : undefined}
      className="group rounded-tile text-left"
      aria-label={`${channel.name}, canal ${channel.number}`}
    >
      <div className="relative aspect-video overflow-hidden rounded-[13px] border border-hairline bg-surface-2">
        <ChannelLogo key={channel.logoUrl} channel={channel} />

        <span className="absolute left-2.5 top-2 font-mono text-[11px] text-zinc-100/45">
          {channel.number}
        </span>

        {isFavorite && (
          <Star
            aria-hidden="true"
            strokeWidth={1.5}
            className="absolute right-2.5 top-2 h-3.5 w-3.5 fill-accent text-accent"
          />
        )}

        {isTuned && (
          <span className="absolute bottom-2 left-2.5 inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em]">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-live" />
            AHORA
          </span>
        )}
      </div>

      <p className="mt-[11px] truncate px-0.5 text-[15px] font-medium">{channel.name}</p>
      <p className="mt-0.5 truncate px-0.5 text-[13px] text-zinc-500">{channel.category}</p>
    </button>
  );
}
