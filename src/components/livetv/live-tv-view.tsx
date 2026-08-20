"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Search, Star, Tv, X } from "lucide-react";
import type { Channel } from "@/lib/types";
import { channelMark } from "@/lib/channels";
import { ChannelRow } from "./channel-row";

/**
 * Canales: categorías, lista y detalle.
 *
 * Derivado de ARVIO — https://github.com/ProdigyV21/ARVIO
 * Origen:  web/components/livetv/LiveTvScreen.tsx
 * Commit:  5bd6a760068ee909692c3df1386af9d6a0d808af
 * Licencia: Apache License 2.0 — ver LICENSES/ARVIO-Apache-2.0.txt
 *
 * MODIFICADO respecto al original (Apache 2.0 §4b):
 *   - Fuera la gestión de listas de reproducción. En ARVIO se añaden y quitan
 *     listas M3U desde la propia pantalla; en CanalCasa la lista se configura
 *     con la variable `M3U_URL` y no hay nada que administrar aquí.
 *   - Fuera el conmutador Lista/Guía y la parrilla EPG: decidido dejarlo para
 *     una tanda posterior.
 *   - Fuera Catch-up, el lanzamiento en VLC y los avisos de Xtream, que
 *     dependen de infraestructura que esta app no tiene.
 *   - Textos en español y filtrado delegado al shell, que ya lo hacía.
 *
 * Se conservan sus nombres de clase al pie de la letra: son el contrato con
 * arvio-shell.css.
 */

/** Cuántas filas se pintan de golpe antes de pedir más al llegar abajo. */
const LOTE = 60;

function hora(millis?: number): string {
  if (!millis) return "";
  return new Date(millis).toLocaleTimeString("es-GT", { hour: "numeric", minute: "2-digit" });
}

function porcentaje(inicio?: number, fin?: number): number | null {
  if (!inicio || !fin || fin <= inicio) return null;
  return Math.min(100, Math.max(0, ((Date.now() - inicio) / (fin - inicio)) * 100));
}

interface LiveTvViewProps {
  /** Todos los canales; alimenta los recuentos de cada categoría. */
  channels: Channel[];
  /** Los que pasan el filtro actual de categoría y búsqueda. */
  visible: Channel[];
  tuned: Channel | null;
  favorites: Set<number>;
  categories: string[];
  category: string;
  search: string;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  onTune: (channel: Channel) => void;
  onToggleFavorite: (id: number) => void;
}

export function LiveTvView({
  channels,
  visible,
  tuned,
  favorites,
  categories,
  category,
  search,
  onCategoryChange,
  onSearchChange,
  onTune,
  onToggleFavorite,
}: LiveTvViewProps) {
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [pintadas, setPintadas] = useState(LOTE);
  const centinela = useRef<HTMLDivElement | null>(null);

  const recuentos = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const channel of channels) {
      mapa.set(channel.category, (mapa.get(channel.category) ?? 0) + 1);
    }
    return mapa;
  }, [channels]);

  // Cambiar de categoría o buscar reinicia el recorte durante el render: con un
  // efecto se pintaría un fotograma con las filas de la categoría anterior.
  const [filtroPrevio, setFiltroPrevio] = useState(`${category}|${search}`);
  const filtroActual = `${category}|${search}`;
  if (filtroPrevio !== filtroActual) {
    setFiltroPrevio(filtroActual);
    setPintadas(LOTE);
  }

  // Pintar 500 filas de golpe cuesta cientos de milisegundos en un televisor.
  // Se pintan por lotes y el siguiente entra cuando el centinela del final se
  // asoma, que es lo mismo que hace ARVIO fila a fila.
  useEffect(() => {
    const nodo = centinela.current;
    if (!nodo || typeof IntersectionObserver === "undefined") return undefined;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setPintadas((actual) => Math.min(actual + LOTE, visible.length));
        }
      },
      { rootMargin: "600px" },
    );
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [visible.length]);

  const filas = visible.slice(0, pintadas);
  const canal = visible.find((item) => item.id === seleccionado) ?? tuned ?? visible[0] ?? null;
  const progreso = canal ? porcentaje(canal.currentStart, canal.currentEnd) : null;
  const esFavorito = canal ? favorites.has(canal.id) : false;

  return (
    <div className="screen livetv-shell">
      <header className="livetv-topbar">
        <div className="livetv-heading">
          <h2>Canales</h2>
          <span>
            {channels.length.toLocaleString("es-GT")} canales · {categories.length - 1} categorías
          </span>
        </div>

        <div className="livetv-search">
          <Search size={17} />
          <input
            data-nav="input"
            value={search}
            onChange={(evento) => onSearchChange(evento.target.value)}
            placeholder="Buscar canal"
            aria-label="Buscar canal"
          />
          {search && (
            <button type="button" onClick={() => onSearchChange("")} aria-label="Borrar búsqueda">
              <X size={15} />
            </button>
          )}
        </div>
      </header>

      <div className="livetv-columns">
        <nav className="livetv-cats" aria-label="Categorías de canales">
          {categories.map((nombre) => (
            <button
              type="button"
              data-nav="button"
              key={nombre}
              className={category === nombre ? "is-active" : ""}
              title={nombre}
              onClick={() => {
                onCategoryChange(nombre);
                setSeleccionado(null);
              }}
            >
              <span>{nombre}</span>
              <em>{(nombre === "Todas" ? channels.length : (recuentos.get(nombre) ?? 0)).toLocaleString("es-GT")}</em>
            </button>
          ))}
        </nav>

        <main className="livetv-list" aria-label={category}>
          <div className="livetv-list-head">
            <h3>{category}</h3>
            <span>
              {filas.length < visible.length
                ? `${filas.length} de ${visible.length.toLocaleString("es-GT")}`
                : visible.length.toLocaleString("es-GT")}
            </span>
          </div>

          {visible.length === 0 ? (
            <div className="livetv-list-empty">
              <Search size={28} />
              <p>
                Ningún canal coincide con {search.trim() ? `«${search.trim()}»` : "esta categoría"}.
              </p>
              {search.trim() && (
                <button type="button" className="secondary" onClick={() => onSearchChange("")}>
                  Borrar búsqueda
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="livetv-rows">
                {filas.map((item) => (
                  <ChannelRow
                    key={item.id}
                    channel={item}
                    favorite={favorites.has(item.id)}
                    selected={canal?.id === item.id}
                    onFocus={() => setSeleccionado(item.id)}
                    onPlay={() => onTune(item)}
                    onToggleFavorite={() => onToggleFavorite(item.id)}
                  />
                ))}
              </div>
              <div ref={centinela} aria-hidden="true" />
            </>
          )}
        </main>

        <aside className="livetv-detail" aria-label="Detalle del canal">
          {canal ? (
            <>
              <div className="livetv-detail-art">
                {canal.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={canal.logoUrl} alt="" loading="lazy" />
                ) : (
                  <b className="livetv-row-mark">{channelMark(canal)}</b>
                )}
              </div>

              <p className="livetv-detail-group">
                {canal.number} · {canal.category}
              </p>
              <h2>{canal.name}</h2>

              {canal.currentProgram ? (
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
                    <span className="livetv-progress">
                      <span style={{ width: `${progreso}%` }} />
                    </span>
                  )}
                </div>
              ) : (
                <p className="livetv-detail-empty">
                  Este canal no tiene guía de programación.
                </p>
              )}

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
            </>
          ) : (
            <div className="livetv-detail-empty-state">
              <Tv size={44} />
              <p>Elige un canal para ver su información.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
