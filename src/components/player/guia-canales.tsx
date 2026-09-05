"use client";

import { useEffect, useMemo, useRef } from "react";
import { channelMark } from "@/lib/channels";
import type { Channel } from "@/lib/types";

/**
 * La tira de canales que asoma por abajo durante la reproducción.
 *
 * Estaba dentro de `FullscreenPlayer`, que además gestionaba el reproductor,
 * los controles, los atajos de teclado, el Cast y los temporizadores. Cinco
 * cosas sin relación entre sí en un solo componente: eso es lo que CodeScene
 * llama *Bumpy Road*, y por qué había que leerlo entero para tocar cualquiera.
 *
 * Se lleva consigo el efecto que mantiene el canal sintonizado a la vista, que
 * es lo único que esta tira necesita recordar.
 */
/**
 * Canales a cada lado del sintonizado. Cincuenta botones llenan de sobra
 * cualquier pantalla y dejan margen para zapear sin volver a montar nada.
 */
const VENTANA = 25;

export function GuiaCanales({
  playlist,
  channelId,
  onTune,
}: {
  playlist: Channel[];
  /** El sintonizado: se resalta y se mantiene dentro del encuadre. */
  channelId: number;
  onTune: (canal: Channel) => void;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);

  /**
   * Solo una ventana alrededor del canal sintonizado, nunca la lista entera.
   *
   * Cada botón de aquí abajo son cinco nodos (`button`, `span`, `img`, `em`,
   * `p`). Con la categoría «Todas» la lista son 7.822 canales, así que pintarla
   * completa creaba **unos 39.000 nodos de golpe, y de forma síncrona, con el
   * vídeo reproduciendo**: el televisor se queda congelado varios segundos con
   * el audio siguiendo. Encima disparaba 7.822 `<img>` a dominios arbitrarios.
   *
   * Con la ventana son ~250 nodos y la guía se abre al instante. El efecto de
   * abajo tampoco tiene ya que buscar entre miles de elementos ni recorrer
   * miles de píxeles de `scrollLeft`.
   *
   * Se recentra sola al zapear, porque `channelId` está en las dependencias:
   * al llegar a un borde de la ventana, la siguiente ya viene desplazada.
   */
  const visibles = useMemo(() => {
    if (playlist.length <= VENTANA * 2) return playlist;
    const actual = playlist.findIndex((canal) => canal.id === channelId);
    const centro = actual >= 0 ? actual : 0;
    const desde = Math.max(0, Math.min(centro - VENTANA, playlist.length - VENTANA * 2));
    return playlist.slice(desde, desde + VENTANA * 2);
  }, [playlist, channelId]);

  /**
   * Traer el canal sintonizado al encuadre al abrir la guía o al zapear.
   *
   * Sin esto, en una lista de 7.800 canales la guía se abre por el principio y
   * el que se está viendo queda a miles de píxeles: parece que no está.
   *
   * Se ajusta `scrollLeft` a mano en vez de usar `scrollIntoView` porque este
   * último también scrollea los ancestros, y aquí eso movería la página entera
   * por debajo del vídeo.
   */
  useEffect(() => {
    const rail = railRef.current;
    const activo = rail?.querySelector<HTMLElement>(`[data-guide-id="${channelId}"]`);
    if (!rail || !activo) return;

    const caja = activo.getBoundingClientRect();
    const marco = rail.getBoundingClientRect();
    const margen = 28;

    if (caja.left < marco.left + margen) rail.scrollLeft += caja.left - marco.left - margen;
    else if (caja.right > marco.right - margen) rail.scrollLeft += caja.right - marco.right + margen;
  }, [channelId]);

  return (
    <div className="guia">
      <div className="guia-cabecera tv-safe">
        <span>{playlist.length.toLocaleString("es-GT")} canales</span>
        <span>← → recorrer · OK sintonizar</span>
      </div>

      <div ref={railRef} className="guia-tira scroll-none tv-safe">
        {visibles.map((canal) => (
          <button
            key={canal.id}
            type="button"
            data-guide-id={canal.id}
            data-nav="tile"
            onClick={() => onTune(canal)}
            aria-current={canal.id === channelId ? "true" : undefined}
            className={`guia-canal ${canal.id === channelId ? "is-active" : ""}`}
          >
            <span className="guia-canal-arte">
              {canal.logoUrl ? (
                // `<img>` plano: los logos vienen de cientos de dominios y
                // `next/image` exige declararlos todos en `remotePatterns`.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={canal.logoUrl} alt="" loading="lazy" />
              ) : (
                <b>{channelMark(canal)}</b>
              )}
              <em>{canal.number}</em>
            </span>
            <p>{canal.name}</p>
            {/* Mismo dato que ya pinta `channel-row.tsx` en la lista: el
                programa actual viaja en `Channel` cuando la guía lo trae, no
                hace falta pedir nada aparte. Sin porcentaje ni reloj: la tira
                es demasiado angosta para una barra legible a tres metros. */}
            {canal.currentProgram && <p className="is-muted">{canal.currentProgram}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
