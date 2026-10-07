"use client";

import { useEffect, useState } from "react";
import { channelMark } from "@/lib/channels";
import { hora, porcentajeDelPrograma } from "@/lib/guia-epg";
import type { EstadoEmision } from "@/lib/telemetria";
import type { Channel } from "@/lib/types";
import type { StreamPlayerState } from "@/components/stream-player";

/**
 * Qué está pasando con la emisión, dicho sin inventar nada.
 *
 * `sintonizando` no es un adorno: mientras el `<video>` no tenga altura no ha
 * llegado ni un fotograma, así que decir «EN VIVO» sobre una pantalla negra
 * sería mentir justo cuando la persona está mirando a ver si funciona.
 *
 * Vivía dentro de `fullscreen-player.tsx`; aquí lo usan los dos reproductores,
 * que antes decían cosas distintas del mismo estado (Inicio ponía «EN VIVO»
 * siempre, aunque no hubiera imagen).
 *
 * El orden es el del aviso que se ve en el vídeo, para que la píldora nunca le
 * lleve la contraria: mientras conecta dice CONECTANDO aunque llegue un
 * `waiting` (antes ponía «CARGANDO» con «Sintonizando…» debajo), salvo que el
 * navegador haya pedido un toque, que es «Toca para ver» y va con EN PAUSA.
 */
export function estadoDeEmision(state: StreamPlayerState): EstadoEmision {
  if (state.streamError) return "sin-senal";
  if (state.conectando && !state.needsUserGesture) return "sintonizando";
  if (!state.isPlaying) return "pausa";
  if (state.buffering) return "buffering";
  return state.alto ? "vivo" : "sintonizando";
}

/**
 * La etiqueta corta. En mayúsculas pequeñas y dentro de una píldora, como el
 * «LIVE» de Apple TV: es una marca, no una frase, y se reconoce por la forma
 * antes de leerla.
 */
const ETIQUETA: Record<EstadoEmision, string> = {
  vivo: "En vivo",
  emitiendo: "En vivo",
  sintonizando: "Conectando",
  buffering: "Cargando",
  pausa: "En pausa",
  "sin-senal": "Sin señal",
};

export function PildoraEstado({ estado }: { estado: EstadoEmision }) {
  return (
    <span className={`vivo-pildora is-${estado}`}>
      {/* El punto solo en directo: en pausa o sin señal sería un indicador
          encendido mintiendo. */}
      {estado === "vivo" && <span className="vivo-pildora-punto" aria-hidden="true" />}
      {ETIQUETA[estado]}
    </span>
  );
}

/**
 * Quién y qué: el logo, la píldora de estado, el nombre del canal y, si la
 * guía lo trae, el programa. Es el «rótulo» de cualquier tele de pago —el que
 * aparece al cambiar de canal— y el mismo en Inicio y en pantalla completa,
 * solo cambia de talla.
 *
 * El nombre del canal es lo más grande y lo más blanco del bloque. Antes era al
 * revés: «EN VIVO» y la categoría en versalitas tecleadas competían con él, y el
 * nombre quedaba en gris por debajo del velo de «Sintonizando».
 */
export function InfoVivo({
  channel,
  estado,
  talla,
}: {
  channel: Channel;
  estado: EstadoEmision;
  talla: "compacta" | "grande";
}) {
  return (
    <div className={`vivo-info is-${talla}`}>
      {/* `key`: un logo que falló no condena al del canal siguiente. */}
      <LogoCanal key={channel.id} channel={channel} />
      <div className="vivo-texto">
        <div className="vivo-linea">
          <PildoraEstado estado={estado} />
          <span className="vivo-meta">
            <span className="vivo-numero">{channel.number}</span>
            {channel.category && (
              <>
                <span aria-hidden="true"> · </span>
                {channel.category}
              </>
            )}
          </span>
        </div>
        <h2 className="vivo-nombre">{channel.name}</h2>
        {channel.currentProgram && <p className="vivo-programa">{channel.currentProgram}</p>}
      </div>
    </div>
  );
}

/**
 * El logo del canal, con las iniciales de respaldo si no hay o no carga.
 *
 * `className` deja usar el mismo respaldo en otra talla: los avisos del
 * reproductor (`.player-conectando-logo`) lo pintan en grande mientras
 * conecta y apagado cuando no hay señal.
 */
export function LogoCanal({
  channel,
  className = "vivo-logo",
}: {
  channel: Channel;
  className?: string;
}) {
  const [fallo, setFallo] = useState(false);
  return (
    <span className={className} aria-hidden="true">
      {channel.logoUrl && !fallo ? (
        // `<img>` plano: los logos vienen de cientos de dominios y
        // `next/image` exige declararlos todos en `remotePatterns`.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={channel.logoUrl}
          src={channel.logoUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFallo(true)}
        />
      ) : (
        <b>{channelMark(channel)}</b>
      )}
    </span>
  );
}

/**
 * La barra del programa: cuánto lleva y a qué hora empezó y acaba.
 *
 * Solo con guía. Sin ella no hay nada honesto que dibujar —una emisión en
 * directo no tiene principio ni final que se conozca—, y una barra llena «de
 * adorno» se lee como «se acabó».
 */
export function BarraPrograma({ channel, activo }: { channel: Channel; activo: boolean }) {
  const ahora = useTicDeMinuto(activo);
  const progreso = porcentajeDelPrograma(channel.currentStart, channel.currentEnd, ahora);
  if (progreso === null) return null;

  return (
    <div className="vivo-barra">
      <span className="vivo-barra-hora">{hora(channel.currentStart)}</span>
      <div
        className="vivo-barra-riel"
        role="progressbar"
        aria-valuenow={Math.round(progreso)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${channel.currentProgram ?? "Programa"}: ${Math.round(progreso)}% emitido`}
      >
        <div className="vivo-barra-relleno" style={{ width: `${progreso}%` }} />
      </div>
      <span className="vivo-barra-hora">{hora(channel.currentEnd)}</span>
    </div>
  );
}

/**
 * El reloj de pared, **solo mientras se está mirando**, y cada 30 segundos: la
 * barra avanza un píxel por minuto en un programa de una hora, así que un tic
 * por segundo era volver a pintar sin que nada cambiara. En un televisor viejo
 * ese repintado inútil es el tirón que se nota al zapear.
 */
function useTicDeMinuto(activo: boolean): number | undefined {
  const [ahora, setAhora] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!activo) return;
    // La primera lectura va aquí y no en el render: el reloj de pared es un
    // sistema externo, y mientras la barra estuvo escondida pudo pasar media
    // hora.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [activo]);

  return ahora;
}
