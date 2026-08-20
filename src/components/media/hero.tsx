"use client";

import { useEffect, useRef, useState } from "react";
import { Info, Play } from "lucide-react";
import type { CardItem } from "@/lib/media-item";

/**
 * Cabecera grande y rotativa de Inicio.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/home/HomeScreen.tsx (la sección `.hero` y su rotación)
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b):
 *   - Extraído a su propio componente. En ARVIO vive dentro de HomeScreen junto
 *     al resto de la pantalla; separarlo permite que Inicio se ocupe solo de
 *     decidir qué rieles pinta.
 *   - Sin la búsqueda del logotipo del título en TMDB: el catálogo ya llega
 *     resuelto del servidor, así que el hero no dispara peticiones.
 *   - Textos en español.
 *
 * Dos comportamientos del original que sí se conservan porque son los que hacen
 * que se sienta vivo: rota cada 8 segundos, y se queda quieto en cuanto la
 * persona señala una tarjeta —lo que apunta manda sobre el carrusel.
 */
const ROTACION_MS = 8000;

interface HeroProps {
  /** Candidatos a rotar. El primero es el que se ve al entrar. */
  pool: CardItem[];
  /** Fijado desde fuera (una tarjeta señalada). Detiene la rotación. */
  pinned?: CardItem | null;
  onPlay: (item: CardItem) => void;
  onDetails?: (item: CardItem) => void;
  /** Etiqueta pequeña sobre el título, ej. "CONTINUAR VIENDO". */
  eyebrow?: string;
}

export function Hero({ pool, pinned, onPlay, onDetails, eyebrow }: HeroProps) {
  const [index, setIndex] = useState(0);
  const interacted = useRef(false);

  useEffect(() => {
    if (pinned) interacted.current = true;
  }, [pinned]);

  useEffect(() => {
    if (pool.length < 2) return undefined;
    const timer = window.setInterval(() => {
      if (interacted.current) return;
      setIndex((current) => (current + 1) % pool.length);
    }, ROTACION_MS);
    return () => window.clearInterval(timer);
  }, [pool.length]);

  // El índice puede quedar fuera de rango si la lista se acorta entre renders
  // (cambia el catálogo, se vacía Seguir viendo). El módulo lo devuelve dentro.
  const rotating = pool.length > 0 ? pool[index % pool.length] : null;
  const item = pinned ?? rotating;
  if (!item) return null;

  const meta = [item.meta, item.metaRight].filter(Boolean) as string[];

  return (
    <section
      className="hero"
      style={item.backdrop ? { backgroundImage: `url(${item.backdrop})` } : undefined}
    >
      <div className="hero-copy" key={item.key}>
        {eyebrow && <span className="hero-eyebrow">{eyebrow}</span>}
        <h2>{item.title}</h2>

        {meta.length > 0 && (
          <div className="hero-meta">
            {meta.map((bit) => (
              <span key={bit}>{bit}</span>
            ))}
          </div>
        )}

        {item.overview && (
          <p>{item.overview.length > 180 ? `${item.overview.slice(0, 180)}…` : item.overview}</p>
        )}

        <div className="hero-actions">
          <button type="button" data-nav="button" className="primary" onClick={() => onPlay(item)}>
            <Play size={20} fill="currentColor" /> Ver ahora
          </button>
          {onDetails && (
            <button
              type="button"
              data-nav="button"
              className="secondary"
              onClick={() => onDetails(item)}
            >
              <Info size={20} /> Más información
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
