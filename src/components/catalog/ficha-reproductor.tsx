"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Info } from "lucide-react";
import { ServerPicker } from "./server-picker";
import { buildEmbedUrl, getProviders } from "@/lib/catalog/providers";
import type { ManualStream, MediaType, PlaybackSource } from "@/lib/catalog/types";
import type { RespuestaStream, ServidorStream } from "@/lib/resolvers/types";

// El reproductor nativo arrastra hls.js: solo se descarga si la ficha usa un
// enlace propio, no cuando se delega en el iframe del proveedor.
const NativePlayer = dynamic(() => import("@/components/native-player"), {
  ssr: false,
  loading: () => <div className="ficha-marco is-cargando" />,
});

/**
 * El reproductor de una ficha.
 *
 * - **Enlace propio** (`manual`): un `<video>` nuestro con controles completos.
 * - **Catálogo de TMDB** (`embed`): la lista de servidores (embeds) la arma
 *   la ruta `/api/stream` y el cambio entre ellos lo hace la persona con los
 *   botones de siempre, porque desde fuera de cada servidor no hay forma
 *   honesta de saber si funciona.
 */
export function FichaReproductor({
  fuente,
  titulo,
  tmdbId,
  mediaType,
  temporada,
  episodio,
  spokenInSpanish,
}: {
  fuente: PlaybackSource;
  titulo: string;
  /** Sin tmdbId no hay catálogo que consultar: solo sirven los enlaces propios. */
  tmdbId: number | null;
  mediaType: MediaType;
  temporada: number;
  episodio: number;
  spokenInSpanish: boolean;
}) {
  if (fuente.kind === "manual") {
    return (
      <section className="ficha-reproductor">
        <NativePlayer streams={fuente.streams} title={titulo} />
      </section>
    );
  }

  if (!tmdbId) {
    return (
      <section className="ficha-reproductor">
        <div className="ficha-sin-fuente">
          <Info aria-hidden="true" />
          <p>No se puede reproducir esta ficha</p>
          <span>
            Le falta el identificador de TMDB, que es lo que usan los servidores para encontrar
            el título.
          </span>
        </div>
      </section>
    );
  }

  return (
    // La key reinicia el componente —y con él el servidor elegido— al cambiar
    // de título o episodio, sin efectos que copien props a estado.
    <ReproductorCatalogo
      key={`${tmdbId}|${mediaType}|${temporada}|${episodio}`}
      titulo={titulo}
      tmdbId={tmdbId}
      mediaType={mediaType}
      temporada={temporada}
      episodio={episodio}
      spokenInSpanish={spokenInSpanish}
    />
  );
}

/**
 * El reproductor cuando el título viene del catálogo de TMDB.
 *
 * Mientras `/api/stream` responde se enseña ya el iframe de VidSrc, armado en
 * el cliente con las plantillas de siempre: la primera imagen tarda lo mismo
 * que antes. Cuando llega la lista, todos los servidores quedan como botones y
 * el activo por defecto es el primero (un embed, instantáneo).
 */
function ReproductorCatalogo({
  titulo,
  tmdbId,
  mediaType,
  temporada,
  episodio,
  spokenInSpanish,
}: {
  titulo: string;
  tmdbId: number;
  mediaType: MediaType;
  temporada: number;
  episodio: number;
  spokenInSpanish: boolean;
}) {
  const servidores = useServidores(tmdbId, titulo, mediaType, temporada, episodio);
  // La elección manual vive y muere con este componente: el padre lo monta con
  // una key distinta por título/episodio, así que aquí nunca llega una elección
  // vieja de otro capítulo.
  const [elegidoId, setElegidoId] = useState<string | null>(null);

  // Fallback inmediato: el mismo iframe de VidSrc que se veía antes de que
  // existiera esta ruta. Si `/api/stream` falla, es lo que queda en pantalla.
  const vidSrcUrl = useMemo(() => {
    const vidsrc = getProviders().find((provider) => provider.id === "vidsrc");
    return vidsrc
      ? buildEmbedUrl(vidsrc, mediaType, { tmdbId, season: temporada, episode: episodio })
      : null;
  }, [mediaType, tmdbId, temporada, episodio]);

  // Elegido manual, si no el primero de la lista (un embed, instantáneo), y
  // como último recurso el fallback de VidSrc. Memoizado para que la identidad
  // no cambie con cada render: de ella cuelga la lista que reinicia o no al
  // reproductor.
  const activo: ServidorStream | null = useMemo(
    () =>
      servidores.find((servidor) => servidor.id === elegidoId) ??
      servidores[0] ??
      (vidSrcUrl
        ? { id: "vidsrc", label: "VidSrc", tipo: "embed" as const, url: vidSrcUrl }
        : null),
    [elegidoId, servidores, vidSrcUrl],
  );

  /**
   * La lista de streams debe conservar la identidad entre renders. El
   * reproductor rearranca la emisión cuando cambia el objeto `stream` que
   * recibe; recrear el array inline en cada render —cuando llega la lista de
   * servidores, al elegir otro, con cualquier parpadeo— reiniciaba el vídeo
   * desde cero: el «se repite el reproductor» reportado en televisores.
   */
  const streamDirecto = useMemo<ManualStream[]>(
    () => (activo ? [{ label: titulo, url: activo.url, type: "auto" }] : []),
    [titulo, activo],
  );

  if (!activo) {
    return (
      <section className="ficha-reproductor">
        <div className="player-surface ficha-marco is-cargando" />
      </section>
    );
  }

  return (
    <section className="ficha-reproductor">
      <div className="ficha-conjunto">
        <div className="player-surface ficha-marco">
          {activo.tipo === "video" ? (
            /* Enlace directo (.mp4/.m3u8) de un addon: reproductor HTML5
               propio con hls.js — la única vía sin anuncios. */
            <NativePlayer streams={streamDirecto} title={titulo} />
          ) : (
            /* Sandbox UNIFORME para todos los embeds, no solo para el que lo
               toleraba. Sin `sandbox`, un iframe externo puede navegar la
               ventana entera (`window.top.location = …`), y los guiones de
               publicidad de estos proveedores hacen exactamente eso; en una
               televisión —sin ventanas emergentes— es su única vía. Fue la
               causa del bucle de recargas infinitas en Samsung: abrir una
               película bastaba para que el landing se recargara una y otra
               vez sin que el vídeo llegara a arrancar.

               El set permite scripts, same-origin (su almacenamiento y sus
               llamadas), formularios y presentación: el mínimo para que el
               reproductor del proveedor funcione y pida su propia pantalla
               completa. Niega todo lo demás: navegar la página completa,
               popups y pointer-lock. Si algún proveedor se negara a
               renderizar así, se saca de `EMBED_PROVIDERS`: no vale exponer
               la app entera por uno. */
            <iframe
              src={activo.url}
              title={titulo}
              allowFullScreen
              allow="autoplay; encrypted-media; fullscreen"
              referrerPolicy="origin"
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            />
          )}
        </div>

        {/* Al pie del vídeo, no suelto en la página: es un control de este
            reproductor, y cuando la imagen no se ve la mano ya está ahí. */}
        <ServerPicker
          providers={servidores.map((servidor) => ({ id: servidor.id, label: servidor.label }))}
          activeId={activo.id}
          onSelect={setElegidoId}
          nota={
            /* Se distingue lo que se sabe con certeza (se rodó en español) de
               lo que solo se puede pedir (subtítulos del embed), para no
               prometer pistas que quizá no existan. */
            spokenInSpanish ? (
              <span className="ficha-marca is-si">Hablada en español</span>
            ) : (
              <span className="ficha-marca is-quiza">Subtítulos en español</span>
            )
          }
        />
      </div>
    </section>
  );
}

/**
 * Pide a `/api/stream` los servidores del título: una sola llamada, respuesta
 * inmediata con la lista completa de embeds.
 */
function useServidores(
  tmdbId: number,
  titulo: string,
  mediaType: MediaType,
  temporada: number,
  episodio: number
): ServidorStream[] {
  const [servidores, setServidores] = useState<ServidorStream[]>([]);

  useEffect(() => {
    // Cada parámetro por separado: son primitivos y el efecto solo se repite
    // cuando cambia de verdad el título o el episodio pedido.
    const controlador = new AbortController();
    const params = new URLSearchParams({
      tmdbId: String(tmdbId),
      title: titulo,
      type: mediaType,
      season: String(temporada),
      episode: String(episodio),
    });
    fetch(`/api/stream?${params}`, { signal: controlador.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<RespuestaStream>;
      })
      .then((data) =>
        setServidores(
          (data.servidores ?? []).filter(
            (servidor) => typeof servidor.url === "string" && /^https?:\/\//i.test(servidor.url)
          )
        )
      )
      .catch(() => {
        /* Abortado o la ruta falló: se queda el fallback de VidSrc. */
      });

    return () => controlador.abort();
  }, [tmdbId, titulo, mediaType, temporada, episodio]);

  return servidores;
}
