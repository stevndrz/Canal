"use client";

import { useState } from "react";
import { Play, Star, Tv } from "lucide-react";
import type { Channel } from "@/lib/types";
import { channelMark } from "@/lib/channels";
import { describirCanal } from "@/lib/describir-canal";
import { hora, porcentajeDelPrograma } from "@/lib/guia-epg";

/**
 * La columna de detalle de Canales: qué es este canal y qué están dando.
 *
 * Salió de `live-tv-view.tsx`, que pasaba de 500 líneas llevando tres cosas a
 * la vez —categorías, lista y esto—. Aquí no hay estado ni efectos: recibe el
 * canal y lo pinta.
 */
export function PanelCanal({
  canal,
  esFavorito,
  onTune,
  onToggleFavorite,
}: {
  canal: Channel | null;
  esFavorito: boolean;
  onTune: (canal: Channel) => void;
  onToggleFavorite: (id: number) => void;
}) {
  /**
   * El logo, con su propio estado de fallo — igual que `LogoCanal` en la
   * fila de la lista. Sin esto no había ningún manejo de error aquí: un
   * logo que 404 o que un CDN bloquea por «hotlink» (algunos devuelven un
   * marcador de imagen rota cuando el `Referer` no es el suyo, en vez de
   * negarse limpio) se quedaba mostrando el icono roto del navegador, sin
   * caer nunca al monograma de la categoría como en el resto de la app.
   *
   * `logoDeId` guarda de qué canal es el fallo guardado: al cambiar de
   * canal hay que olvidarlo, o un logo que sí carga se vería sustituido por
   * el fallo del canal anterior durante un instante.
   */
  const [logoDeId, setLogoDeId] = useState<number | null>(null);
  const [logoFalla, setLogoFalla] = useState(false);
  if (canal && logoDeId !== canal.id) {
    setLogoDeId(canal.id);
    setLogoFalla(false);
  }

  if (!canal) {
    return (
      <aside className="livetv-detail" aria-label="Detalle del canal">
        <div className="livetv-detail-empty-state">
          <Tv size={44} />
          <p>Elige un canal para ver su información.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="livetv-detail" aria-label="Detalle del canal">
      <div className="livetv-detail-art">
        {canal.logoUrl && !logoFalla ? (
          // `<img>` plano: los logos salen de cientos de dominios de listas IPTV.
          // `no-referrer` evita que un CDN con protección «anti-hotlink» —que
          // bloquea la imagen cuando ve un `Referer` de otro dominio— la
          // rechace precisamente por venir de esta app.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={canal.logoUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setLogoFalla(true)}
          />
        ) : (
          <b className="livetv-row-mark">{channelMark(canal)}</b>
        )}
      </div>

      <p className="livetv-detail-group">
        {canal.number} · {canal.category}
      </p>
      <h2>{canal.name}</h2>

      {canal.currentProgram ? <EnEmision canal={canal} /> : <AcercaDelCanal canal={canal} />}

      {canal.nextProgram && (
        <div className="livetv-program is-next">
          <div className="livetv-program-head">
            <span>DESPUÉS</span>
            {canal.nextStart && <em>{hora(canal.nextStart)}</em>}
          </div>
          <strong>{canal.nextProgram}</strong>
        </div>
      )}

      <div className="livetv-detail-actions">
        <button type="button" data-nav="button" className="primary" onClick={() => onTune(canal)}>
          <Play size={17} fill="currentColor" /> Ver ahora
        </button>
        <button
          type="button"
          data-nav="button"
          className={esFavorito ? "secondary is-active" : "secondary"}
          aria-pressed={esFavorito}
          onClick={() => onToggleFavorite(canal.id)}
        >
          <Star size={17} fill={esFavorito ? "currentColor" : "none"} />
          {esFavorito ? "En favoritos" : "Favorito"}
        </button>
      </div>
    </aside>
  );
}

function EnEmision({ canal }: { canal: Channel }) {
  // El reloj se lee al montar, como en la fila: un temporizador por panel para
  // mover una barra que avanza un píxel por minuto no lo vale.
  // eslint-disable-next-line react-hooks/purity -- el reloj decide cuánto lleva emitido
  const progreso = porcentajeDelPrograma(canal.currentStart, canal.currentEnd, Date.now());

  return (
    <div className="livetv-program">
      <div className="livetv-program-head">
        <span>AHORA</span>
        {canal.currentStart && (
          <em>
            {hora(canal.currentStart)} – {hora(canal.currentEnd)}
          </em>
        )}
      </div>
      <strong>{canal.currentProgram}</strong>
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
    </div>
  );
}

/**
 * Sin guía, se cuenta lo que sí se sabe del canal en vez de dejar la columna
 * vacía. Todo se deriva en el cliente: cero peticiones y cero bytes de más en
 * los 7.822 canales que viajan en el HTML.
 */
function AcercaDelCanal({ canal }: { canal: Channel }) {
  const { descripcion, datos } = describirCanal(canal);

  return (
    <div className="livetv-acerca">
      <p className="livetv-acerca-texto">{descripcion}</p>

      <dl className="livetv-acerca-datos">
        {datos.map(({ termino, valor }) => (
          <div key={termino}>
            <dt>{termino}</dt>
            <dd>{valor}</dd>
          </div>
        ))}
      </dl>

      <p className="livetv-acerca-nota">Este canal no publica guía de programación.</p>
    </div>
  );
}
