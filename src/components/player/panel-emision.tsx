"use client";

import { useEffect, useState } from "react";
import type { Channel } from "@/lib/types";
import { porcentajeDelPrograma } from "@/lib/guia-epg";
import { palabraDeEstado, type EstadoEmision } from "@/lib/telemetria";

/**
 * La cabecera del reproductor: etiqueta de estado y nombre del canal, nada
 * más — el mismo patrón que el nombre de la película en un reproductor
 * nativo ("PELÍCULA" arriba, el título debajo). Antes llevaba también una
 * tira de telemetría (señal, tasa, tiempo en canal, hora): quedó fuera —era
 * la diferencia real entre "esto se ve como sala de control" y "esto se ve
 * como Netflix/Apple TV", que es lo que se pidió. `modulosDeEmision`
 * (`lib/telemetria.ts`) se queda sin usar aquí, no se borra: si algún día
 * hace falta un panel de diagnóstico aparte, la cuenta ya está hecha y
 * probada.
 *
 * El estado se dice con una palabra y no con un icono: a tres metros y sin
 * manual, «PAUSA» siempre gana a dos rayitas.
 */
export function PanelEmision({
  channel,
  estado,
  /** Con la barra escondida no hay nada que contar: el tic se para. */
  activo,
}: {
  channel: Channel;
  estado: EstadoEmision;
  activo: boolean;
}) {
  const ahora = useTicDeSegundo(activo);
  const progreso = porcentajeDelPrograma(channel.currentStart, channel.currentEnd, ahora);

  return (
    <div className="panel-emision">
      <div className="panel-emision-fila">
        <span className={`panel-estado is-${estado}`}>
          {/* El punto solo tiene sentido en directo: en pausa o sin señal
              sería un indicador encendido mintiendo. */}
          {estado === "vivo" && <span className="live-dot panel-estado-punto" />}
          {palabraDeEstado(estado)}
        </span>

        <span className="panel-canal">
          <b>{channel.number}</b>
          <span className="panel-canal-nombre">{channel.name}</span>
          <span className="panel-canal-cat">{channel.category}</span>
        </span>
      </div>

      {/* Con guía, cuánto lleva el programa; sin ella, una regla que solo
          afirma lo que se sabe de verdad: que esto va en directo. */}
      {channel.currentProgram && progreso !== null ? (
        <div className="panel-programa">
          <div className="panel-programa-texto">
            <span>{channel.currentProgram}</span>
            <span>{Math.round(progreso)}%</span>
          </div>
          <div
            className="panel-programa-riel"
            role="progressbar"
            aria-valuenow={Math.round(progreso)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${channel.currentProgram}, ${Math.round(progreso)}% emitido`}
          >
            <div className="panel-programa-barra" style={{ width: `${progreso}%` }} />
          </div>
        </div>
      ) : (
        <div className="panel-programa is-vacio">
          <div className="panel-programa-riel" />
        </div>
      )}
    </div>
  );
}

/**
 * Un tic por segundo, y **solo mientras se está mirando**.
 *
 * El contador `T+` y el porcentaje del programa se mueven cada segundo, pero la
 * barra se esconde a los cinco: dejar un intervalo corriendo detrás de una
 * cabecera invisible es re-renderizar sin parar para nada, que en un televisor
 * viejo es exactamente el tirón que se nota al zapear.
 */
function useTicDeSegundo(activo: boolean): number | undefined {
  // Sin lectura todavía, `undefined`: los dos que la consumen tratan la
  // ausencia como «este módulo no existe» en vez de pintar un 00:00 o un 0%
  // que no significan nada.
  const [ahora, setAhora] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!activo) return;
    // La primera lectura va aquí y no en el render porque el reloj de pared es
    // un sistema externo: mientras la barra estuvo escondida pudo pasar media
    // hora, y arrancar el intervalo sin ponerla al día dejaría un segundo
    // entero con la hora de la última vez que se miró.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAhora(Date.now());
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activo]);

  return ahora;
}

