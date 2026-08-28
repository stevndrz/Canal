"use client";

import type { Channel } from "@/lib/types";
import { channelMark } from "@/lib/channels";

/**
 * Los canales de la casa: los que se ven de cajón.
 *
 * **No es un riel, y por eso no usa `MediaRail`.** Un riel dice «hay más si
 * sigues»: tiene flechas, scroll y las tarjetas pegadas al margen izquierdo
 * esperando compañía. Aquí son tres, son siempre los mismos y no va a haber un
 * cuarto — es un acceso directo, y una fila de tres tarjetas alineadas a la
 * izquierda en una pantalla de 1920 se lee como un riel al que le faltan
 * carátulas.
 *
 * Así que van centradas y grandes: tres paradas de mando, el logo bien visible
 * desde tres metros y el número de canal debajo, que es lo que la gente de la
 * casa dice en voz alta («pon el tres»).
 *
 * Ver `publicConfig.canalesDeCasa` para de dónde salen y cómo se cambian.
 */
export function FilaCasa({
  canales,
  tunedId,
  onSelect,
}: {
  canales: Channel[];
  tunedId: number | null;
  onSelect: (canal: Channel) => void;
}) {
  // Sin ninguno en la lista de hoy, la sección no existe. Mejor eso que un
  // encabezado con un hueco debajo.
  if (canales.length === 0) return null;

  return (
    <section className="casa" aria-label="Canales de la casa">
      <h3 className="casa-titulo">Casa</h3>

      <div className="casa-fila">
        {canales.map((canal) => (
          <button
            key={canal.id}
            type="button"
            data-nav="button"
            className={`casa-boton ${canal.id === tunedId ? "is-active" : ""}`}
            aria-current={canal.id === tunedId ? "true" : undefined}
            onClick={() => onSelect(canal)}
          >
            <span className="casa-arte">
              {canal.logoUrl ? (
                /* `<img>` plano, como en el resto del diseño: las URLs de logo
                   salen de cientos de dominios de listas IPTV y `next/image`
                   exige declarar cada uno en `remotePatterns`. */
                // eslint-disable-next-line @next/next/no-img-element
                <img src={canal.logoUrl} alt="" loading="eager" />
              ) : (
                <b className="casa-marca">{channelMark(canal)}</b>
              )}
            </span>

            <span className="casa-nombre">{canal.name}</span>
            <span className="casa-numero">{canal.number}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
