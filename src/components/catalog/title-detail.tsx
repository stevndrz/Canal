"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Info, Star, Users } from "lucide-react";
import { buildEmbedUrl, getProviders } from "@/lib/catalog/providers";
import { useGridNavigation } from "@/hooks/use-grid-navigation";
import { ServerPicker } from "./server-picker";
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

  return (
    <div className="min-h-screen bg-[#0b0f14] text-white">
      {/* Portada */}
      <div className="relative">
        {item.backdrop && (
          <div className="absolute inset-0 h-72 sm:h-96">
            <Image src={item.backdrop} alt="" fill sizes="100vw" className="object-cover opacity-40" priority />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f14] via-[#0b0f14]/70 to-transparent" />
          </div>
        )}

        <div className="relative mx-auto max-w-[1400px] px-3 pb-6 pt-4 sm:px-6 md:px-8">
          <Link
            href="/peliculas"
            className="mb-5 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Volver al catálogo
          </Link>

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            {item.poster && (
              <Image
                src={item.poster}
                alt=""
                width={180}
                height={270}
                className="hidden w-32 shrink-0 rounded-xl shadow-2xl ring-1 ring-white/10 sm:block sm:w-44"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{item.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/60">
                {item.year && <span>{item.year}</span>}
                {item.rating !== null && item.rating > 0 && (
                  <span className="flex items-center gap-1 text-amber-300">
                    <Star aria-hidden="true" className="h-4 w-4 fill-current" />
                    {item.rating.toFixed(1)}
                  </span>
                )}
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
                  {isSeries ? "Serie" : "Película"}
                </span>
              </div>
              {item.overview && (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">{item.overview}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-3 pb-12 sm:px-6 md:px-8">
        {/* Reproductor */}
        <section className="mb-8">
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
              <div className="player-surface aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-2xl">
                <iframe
                  src={embedUrl}
                  title={item.title}
                  className="h-full w-full"
                  allowFullScreen
                  allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                  referrerPolicy="origin"
                />
              </div>
              {/* Qué esperar del idioma. Se distingue lo que se sabe con
                  certeza (se rodó en español) de lo que solo se puede pedir
                  (subtítulos), para no prometer un doblaje que quizá no exista. */}
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/40">
                {spokenInSpanish ? (
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">
                    Hablada en español
                  </span>
                ) : activeProvider?.spanishSubtitles ? (
                  <span className="rounded-md bg-sky-500/15 px-2 py-0.5 font-semibold text-sky-300">
                    Se piden subtítulos en español
                  </span>
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
            <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
              <Info aria-hidden="true" className="h-8 w-8 text-white/40" />
              <p className="font-semibold text-white/80">No se puede reproducir esta ficha</p>
              <p className="max-w-md text-sm text-white/50">
                Le falta el identificador de TMDB, que es lo que usan los servidores para
                encontrar el título. Añádelo, o pon un enlace propio en{" "}
                <code className="rounded bg-black/40 px-1">catalog.json</code>.
              </p>
            </div>
          )}
        </section>

        {/* Temporadas y episodios */}
        {isSeries && (
          <section>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold">Episodios</h2>
              {item.seasons.length > 1 && (
                <div className="flex gap-2 overflow-x-auto scrollbar-none" role="tablist" aria-label="Temporadas">
                  {item.seasons.map((season) => (
                    <Link
                      key={season}
                      href={`/peliculas/tv/${item.id}?t=${season}`}
                      role="tab"
                      aria-selected={season === selectedSeason}
                      className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 ${
                        season === selectedSeason
                          ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white"
                          : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      Temporada {season}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {episodes.length > 0 ? (
              <div ref={episodeListRef} className="grid gap-2">
                {episodes.map((episode) => {
                  const active = selectedEpisode?.episode === episode.episode;
                  return (
                    <button
                      key={`${episode.season}-${episode.episode}`}
                      type="button"
                      data-episode
                      onClick={() => setSelectedEpisode(episode)}
                      aria-pressed={active}
                      className={`flex items-center gap-4 rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400 ${
                        active
                          ? "border-violet-400/60 bg-violet-500/15"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <span className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-black/40 text-sm font-bold text-white/70">
                        {episode.still ? (
                          <Image src={episode.still} alt="" width={112} height={63} className="h-full w-full object-cover" />
                        ) : (
                          `E${episode.episode}`
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {episode.episode}. {episode.title}
                        </span>
                        {episode.overview && (
                          <span className="mt-0.5 line-clamp-2 block text-xs text-white/50">{episode.overview}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
                No hay episodios listados. Añade la clave de TMDB o escríbelos en{" "}
                <code className="rounded bg-black/40 px-1">catalog.json</code>.
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
