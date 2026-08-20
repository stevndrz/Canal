"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Info, Star, Users } from "lucide-react";
import { buildEmbedUrl, getProviders } from "@/lib/catalog/providers";
import { useGridNavigation } from "@/hooks/use-grid-navigation";
import { ServerPicker } from "./server-picker";
import { TopNav } from "@/components/shell/top-nav";
import { useAppStore } from "@/store/use-app-store";
import { normalizeRoomId } from "@/lib/watch-party/sign";
import type { PlaybackSource, ResolvedCatalogItem, ResolvedEpisode } from "@/lib/catalog/types";

// El reproductor nativo arrastra hls.js: solo se descarga si la ficha usa un
// enlace propio, no cuando se delega en el iframe del proveedor.
const NativePlayer = dynamic(() => import("@/components/native-player"), {
  ssr: false,
  loading: () => <div className="aspect-video w-full animate-pulse rounded-2xl bg-black" />,
});

export function TitleDetail({
  item,
  episodes,
  selectedSeason,
}: {
  item: ResolvedCatalogItem;
  episodes: ResolvedEpisode[];
  selectedSeason: number;
}) {
  const isSeries = item.mediaType === "tv";
  const [selectedEpisode, setSelectedEpisode] = useState<ResolvedEpisode | null>(
    isSeries ? (episodes[0] ?? null) : null
  );
  const [room, setRoom] = useState("");
  const [activeRoom, setActiveRoom] = useState("");
  const episodeListRef = useRef<HTMLDivElement | null>(null);
  useGridNavigation(episodeListRef, "[data-episode]");

  const providers = getProviders();
  const preferredProvider = useAppStore((state) => state.preferredProvider);
  const setPreferredProvider = useAppStore((state) => state.setPreferredProvider);
  // El guardado manda si sigue existiendo; si no, el primero de la lista, que
  // ya viene ordenada poniendo delante los que piden subtítulos en español.
  const activeProvider =
    providers.find((provider) => provider.id === preferredProvider) ?? providers[0] ?? null;

  /**
   * Si se rodó en español, el audio se oye en español sin depender de doblajes.
   * Es lo único que se puede afirmar: ningún proveedor publica qué pistas de
   * audio tiene, así que para el resto solo se promete subtítulo.
   */
  const spokenInSpanish = item.originalLanguage === "es";

  // Qué se reproduce ahora mismo: el episodio elegido en series, el título en
  // películas. Los episodios pueden traer su propia fuente (otro doblaje).
  const activeSource: PlaybackSource = isSeries ? (selectedEpisode?.source ?? item.source) : item.source;

  const embedUrl = useMemo(() => {
    if (activeSource.kind !== "embed" || !item.tmdbId || !activeProvider) return null;
    return buildEmbedUrl(activeProvider, item.mediaType, {
      tmdbId: item.tmdbId,
      season: selectedSeason,
      episode: selectedEpisode?.episode ?? 1,
    });
  }, [activeSource, item.tmdbId, item.mediaType, selectedSeason, selectedEpisode, activeProvider]);

  const minutos = item.duracion
    ? item.duracion >= 60
      ? `${Math.floor(item.duracion / 60)} h ${item.duracion % 60} min`
      : `${item.duracion} min`
    : null;

  return (
    <div className="app-shell">
      <TopNav />

      {/* El fondo va aquí y no en un `absolute inset-0` desde y=0: así arranca
          por debajo de la barra fija en vez de meterse detrás de ella, que era
          lo que hacía que el título y el botón de volver se leyeran encima de
          la navegación. */}
      <div
        className="ficha-portada"
        style={item.backdrop ? { backgroundImage: `url(${item.backdrop})` } : undefined}
      >
        <div className="ficha-cabecera">
          <Link href="/peliculas" data-nav="button" className="ficha-volver">
            <ArrowLeft aria-hidden="true" />
            Volver al catálogo
          </Link>

          <div className="ficha-titular">
            {item.poster && (
              <Image
                src={item.poster}
                alt=""
                width={342}
                height={513}
                className="ficha-poster"
                priority
              />
            )}

            <div className="ficha-datos">
              <h1>{item.title}</h1>
              {item.tagline && <p className="ficha-tagline">{item.tagline}</p>}

              <div className="ficha-meta">
                {item.year && <span>{item.year}</span>}
                {minutos && <span>{minutos}</span>}
                {item.rating !== null && item.rating > 0 && (
                  <span className="ficha-nota">
                    <Star aria-hidden="true" />
                    {item.rating.toFixed(1)}
                  </span>
                )}
                <span className="ficha-tipo">{isSeries ? "Serie" : "Película"}</span>
              </div>

              {item.generos.length > 0 && (
                <div className="ficha-generos">
                  {item.generos.map((genero) => (
                    <span key={genero}>{genero}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="ficha-cuerpo">
        {/* Reproductor centrado y acotado. A 1400px de ancho el vídeo se comía
            la pantalla en un televisor, y la botonera de servidores quedaba
            colgando a la izquierda muy lejos de la imagen. */}
        <section className="ficha-reproductor">
          {activeSource.kind === "manual" ? (
            <>
              <WatchPartyBar room={room} onRoomChange={setRoom} onJoin={() => setActiveRoom(normalizeRoomId(room))} activeRoom={activeRoom} />
              <NativePlayer
                streams={activeSource.streams}
                title={item.title}
                roomId={activeRoom || undefined}
              />
            </>
          ) : embedUrl ? (
            <>
              <div className="player-surface ficha-marco">
                <iframe
                  src={embedUrl}
                  title={item.title}
                  allowFullScreen
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  referrerPolicy="origin"
                />
              </div>

              {/* Qué esperar del idioma. Se distingue lo que se sabe con
                  certeza (se rodó en español) de lo que solo se puede pedir
                  (subtítulos), para no prometer un doblaje que quizá no exista. */}
              <p className="ficha-idioma">
                {spokenInSpanish ? (
                  <span className="ficha-marca is-si">Hablada en español</span>
                ) : activeProvider?.spanishSubtitles ? (
                  <span className="ficha-marca is-quiza">Se piden subtítulos en español</span>
                ) : null}
                <span>Este título usa el reproductor del proveedor externo, con sus propios controles.</span>
              </p>

              <ServerPicker
                providers={providers}
                activeId={activeProvider?.id ?? ""}
                onSelect={setPreferredProvider}
              />
            </>
          ) : (
            <div className="ficha-sin-fuente">
              <Info aria-hidden="true" />
              <p>No se puede reproducir esta ficha</p>
              <span>
                Le falta el identificador de TMDB, que es lo que usan los servidores para
                encontrar el título. Añádelo, o pon un enlace propio en <code>catalog.json</code>.
              </span>
            </div>
          )}
        </section>

        {/* Debajo del vídeo, que es donde se mira cuando ya se está viendo. */}
        {item.overview && (
          <section className="ficha-seccion">
            <h2>Sinopsis</h2>
            <p className="ficha-sinopsis">{item.overview}</p>
            {item.autoria.length > 0 && (
              <p className="ficha-autoria">
                <strong>{isSeries ? "Creada por" : "Dirigida por"}</strong> {item.autoria.join(", ")}
              </p>
            )}
          </section>
        )}

        {item.reparto.length > 0 && (
          <section className="ficha-seccion">
            <h2>Reparto</h2>
            <div className="ficha-reparto">
              {item.reparto.map((persona) => (
                <figure key={`${persona.nombre}-${persona.personaje}`} className="ficha-persona">
                  {persona.foto ? (
                    <Image src={persona.foto} alt="" width={342} height={513} />
                  ) : (
                    <span className="ficha-persona-inicial" aria-hidden="true">
                      {persona.nombre.slice(0, 1)}
                    </span>
                  )}
                  <figcaption>
                    <strong>{persona.nombre}</strong>
                    {persona.personaje && <span>{persona.personaje}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* Temporadas y episodios */}
        {isSeries && (
          <section className="ficha-seccion">
            <div className="ficha-episodios-cabecera">
              <h2>Episodios</h2>
              {item.seasons.length > 1 && (
                <div className="catalogo-filtros" role="tablist" aria-label="Temporadas">
                  {item.seasons.map((season) => (
                    <Link
                      key={season}
                      href={`/peliculas/tv/${item.id}?t=${season}`}
                      role="tab"
                      data-nav="button"
                      aria-selected={season === selectedSeason}
                      className={`catalogo-chip ${season === selectedSeason ? "is-active" : ""}`}
                    >
                      Temporada {season}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {episodes.length > 0 ? (
              <div ref={episodeListRef} className="ficha-episodios">
                {episodes.map((episode) => {
                  const active = selectedEpisode?.episode === episode.episode;
                  return (
                    <button
                      key={`${episode.season}-${episode.episode}`}
                      type="button"
                      data-episode
                      data-nav="row"
                      onClick={() => setSelectedEpisode(episode)}
                      aria-pressed={active}
                      className={`ficha-episodio ${active ? "is-active" : ""}`}
                    >
                      <span className="ficha-episodio-arte">
                        {episode.still ? (
                          <Image src={episode.still} alt="" width={224} height={126} />
                        ) : (
                          `E${episode.episode}`
                        )}
                      </span>
                      <span className="ficha-episodio-texto">
                        <strong>
                          {episode.episode}. {episode.title}
                        </strong>
                        {episode.overview && <span>{episode.overview}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="ficha-vacio">
                No hay episodios listados. Añade la clave de TMDB o escríbelos en{" "}
                <code>catalog.json</code>.
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

/** Entrada a la sala sincronizada. Solo aparece con enlaces propios. */
function WatchPartyBar({
  room,
  activeRoom,
  onRoomChange,
  onJoin,
}: {
  room: string;
  activeRoom: string;
  onRoomChange: (value: string) => void;
  onJoin: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onJoin();
      }}
      className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3"
    >
      <Users aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-300" />
      <label htmlFor="watch-party-room" className="text-sm font-semibold">
        Ver en familia
      </label>
      <input
        id="watch-party-room"
        value={room}
        onChange={(event) => onRoomChange(event.target.value)}
        placeholder="nombre de la sala"
        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      />
      <button
        type="submit"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        {activeRoom ? "Cambiar sala" : "Entrar"}
      </button>
      <p className="w-full text-xs text-white/45">
        Quien abra esta misma página con el mismo nombre de sala verá la película sincronizada.
      </p>
    </form>
  );
}
