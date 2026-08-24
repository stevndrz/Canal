"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Info, Users } from "lucide-react";
import { ServerPicker } from "./server-picker";
import { buildEmbedUrl, getProviders } from "@/lib/catalog/providers";
import type { MediaType, PlaybackSource } from "@/lib/catalog/types";
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
 * - **Enlace propio** (`manual`): un `<video>` nuestro con Ver en familia.
 * - **Catálogo de TMDB** (`embed`): la lista de servidores la arma la ruta
 *   `/api/stream`, que combina el iframe de VidSrc (Servidor 1) con el enlace
 *   directo resuelto vía Magnet/Debrid (Servidor 2).
 *
 * El Servidor 2 se pinta como un `<video>` propio y el 1 como `iframe`; el
 * cambio entre ellos lo hace la persona con los botones de siempre, porque
 * desde fuera de cada servidor no hay forma honesta de saber si funciona.
 */
export function FichaReproductor({
  fuente,
  titulo,
  tmdbId,
  imdbId,
  mediaType,
  temporada,
  episodio,
  spokenInSpanish,
  sala,
  salaActiva,
  onSalaChange,
  onEntrarSala,
}: {
  fuente: PlaybackSource;
  titulo: string;
  /** Sin tmdbId no hay catálogo que consultar: solo sirven los enlaces propios. */
  tmdbId: number | null;
  /** Id de IMDB, para los servidores que indexan por él (Embed69, VerhdLink). */
  imdbId: string | null;
  mediaType: MediaType;
  temporada: number;
  episodio: number;
  spokenInSpanish: boolean;
  sala: string;
  salaActiva: string;
  onSalaChange: (valor: string) => void;
  onEntrarSala: () => void;
}) {
  if (fuente.kind === "manual") {
    return (
      <section className="ficha-reproductor">
        <BarraVerEnFamilia
          sala={sala}
          salaActiva={salaActiva}
          onSalaChange={onSalaChange}
          onEntrar={onEntrarSala}
        />
        <NativePlayer streams={fuente.streams} title={titulo} roomId={salaActiva || undefined} />
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
      imdbId={imdbId}
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
 * que antes. Cuando llega la lista, todos los servidores quedan como botones;
 * el activo por defecto es el primero de la lista (un embed, instantáneo), y
 * el torrent español de Webtor —que tarda más en arrancar— espera a que alguien
 * lo elija.
 */
function ReproductorCatalogo({
  titulo,
  tmdbId,
  imdbId,
  mediaType,
  temporada,
  episodio,
  spokenInSpanish,
}: {
  titulo: string;
  tmdbId: number;
  imdbId: string | null;
  mediaType: MediaType;
  temporada: number;
  episodio: number;
  spokenInSpanish: boolean;
}) {
  const servidores = useServidores(tmdbId, titulo, imdbId, mediaType, temporada, episodio);
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

  const activo: ServidorStream | null =
    servidores.find((servidor) => servidor.id === elegidoId) ??
    // El primero de la lista es un embed: instantáneo. Webtor (torrent en
    // español) queda a un clic para quien prefiera esperar el doblaje.
    servidores[0] ??
    (vidSrcUrl
      ? { id: "vidsrc", label: "VidSrc", kind: "embed" as const, url: vidSrcUrl }
      : null);

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
          {activo.id === "vimeus" ? (
            /* Vimeus es el único que tolera el sandbox —y por tanto el único
               con los popups bloqueados de verdad—. VidSrc y VideoEasy se
               niegan a cargar dentro de un frame restringido, así que esos
               van sin él: si meten popups, el botón «atrás» del navegador
               sigue siendo la defensa. */
            <iframe
              src={activo.url}
              title={titulo}
              allowFullScreen
              allow="autoplay; encrypted-media; fullscreen"
              referrerPolicy="origin"
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            />
          ) : (
            <iframe
              src={activo.url}
              title={titulo}
              allowFullScreen
              allow="autoplay; encrypted-media; fullscreen"
              referrerPolicy="origin"
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
  imdbId: string | null,
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
    if (imdbId) params.set("imdb", imdbId);

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
  }, [tmdbId, titulo, imdbId, mediaType, temporada, episodio]);

  return servidores;
}

/**
 * Entrada a la sala sincronizada. Solo aparece con enlaces propios.
 *
 * Reutiliza las clases de «Mi enlace» (`.fuente-sala`) en vez de las suyas:
 * es el mismo control haciendo lo mismo, y antes se pintaba con utilidades
 * sueltas en verde esmeralda —el único verde de toda la aplicación—, así que
 * la misma función se veía de dos maneras según la pantalla.
 */
function BarraVerEnFamilia({
  sala,
  salaActiva,
  onSalaChange,
  onEntrar,
}: {
  sala: string;
  salaActiva: string;
  onSalaChange: (valor: string) => void;
  onEntrar: () => void;
}) {
  return (
    <form
      className="fuente-sala"
      onSubmit={(evento) => {
        evento.preventDefault();
        onEntrar();
      }}
    >
      <Users aria-hidden="true" />
      <label htmlFor="ficha-sala">Ver en familia</label>
      <input
        id="ficha-sala"
        data-nav="input"
        value={sala}
        onChange={(evento) => onSalaChange(evento.target.value)}
        placeholder="nombre de la sala"
      />
      <button type="submit" data-nav="button">
        {salaActiva ? "Cambiar sala" : "Entrar"}
      </button>
      <p>
        Quien abra esta misma página con el mismo nombre de sala verá la película sincronizada.
      </p>
    </form>
  );
}
