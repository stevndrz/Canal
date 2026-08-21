"use client";

import dynamic from "next/dynamic";
import { Info, Users } from "lucide-react";
import { ServerPicker } from "./server-picker";
import type { EmbedProvider } from "@/lib/catalog/providers";
import type { PlaybackSource } from "@/lib/catalog/types";

// El reproductor nativo arrastra hls.js: solo se descarga si la ficha usa un
// enlace propio, no cuando se delega en el iframe del proveedor.
const NativePlayer = dynamic(() => import("@/components/native-player"), {
  ssr: false,
  loading: () => <div className="ficha-marco is-cargando" />,
});

/**
 * El reproductor de una ficha, en sus tres formas posibles.
 *
 * Cuál sale depende de la fuente, y las tres son distintas de verdad:
 *
 *  - **Enlace propio** (`manual`): un `<video>` nuestro. Es el único caso con
 *    Ver en familia, porque es el único donde el tiempo del vídeo está a
 *    nuestro alcance.
 *  - **Proveedor** (`embed`): un `iframe` de otro dominio. Desde aquí no se
 *    puede saber si cargó ni en qué idioma está, de ahí que el cambio de
 *    servidor lo haga la persona con un botón.
 *  - **Sin fuente**: se explica por qué, en vez de dejar un rectángulo negro.
 */
export function FichaReproductor({
  fuente,
  titulo,
  embedUrl,
  providers,
  activeProvider,
  onSelectProvider,
  spokenInSpanish,
  sala,
  salaActiva,
  onSalaChange,
  onEntrarSala,
}: {
  fuente: PlaybackSource;
  titulo: string;
  embedUrl: string | null;
  providers: EmbedProvider[];
  activeProvider: EmbedProvider | null;
  onSelectProvider: (id: string) => void;
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

  if (!embedUrl) {
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
    <section className="ficha-reproductor">
      <div className="ficha-conjunto">
        <div className="player-surface ficha-marco">
          <iframe
            src={embedUrl}
            title={titulo}
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            referrerPolicy="origin"
          />
        </div>

        {/* Al pie del vídeo, no suelto en la página: es un control de este
            reproductor, y cuando la imagen no se ve la mano ya está ahí. */}
        <ServerPicker
          providers={providers}
          activeId={activeProvider?.id ?? ""}
          onSelect={onSelectProvider}
          nota={
            /* Se distingue lo que se sabe con certeza (se rodó en español) de
               lo que solo se puede pedir (subtítulos), para no prometer un
               doblaje que quizá no exista. */
            spokenInSpanish ? (
              <span className="ficha-marca is-si">Hablada en español</span>
            ) : activeProvider?.spanishSubtitles ? (
              <span className="ficha-marca is-quiza">Subtítulos en español</span>
            ) : null
          }
        />
      </div>
    </section>
  );
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
