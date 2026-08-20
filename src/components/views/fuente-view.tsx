"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Link2, Play, Trash2, Users } from "lucide-react";
import { useFuentes } from "@/hooks/use-fuentes";
import { esEnlaceFirmado, resolverFuente } from "@/lib/fuente-propia/url";
import { normalizeRoomId } from "@/lib/watch-party/sign";
import type { FuentePropia } from "@/lib/fuente-propia/types";

/** Arrastra hls.js: solo se descarga cuando hay algo que reproducir aquí. */
const NativePlayer = dynamic(() => import("@/components/native-player"), {
  ssr: false,
  loading: () => <div className="fuente-marco is-cargando" />,
});

/**
 * Mi enlace: la tercera vía de reproducción, y la única con Watch Party.
 *
 * Por qué solo aquí, y no en las otras dos:
 *
 *  - **Canales** es señal en directo. Dos personas en el mismo canal ya van
 *    iguales por definición: no se puede pausar ni buscar en una emisión, así
 *    que no hay nada que sincronizar.
 *  - **Películas** se reproducen dentro del iframe de un proveedor externo.
 *    Ese `<video>` vive en otro dominio: desde aquí no se puede leer su tiempo
 *    ni controlarlo. No es difícil, es imposible.
 *  - **Aquí** el `<video>` es nuestro, con su tiempo y sus controles al
 *    alcance. Es el único sitio donde igualar el segundo exacto entre dos
 *    casas es algo que se pueda cumplir.
 *
 * El contrato completo y lo que queda por crecer está en
 * `docs/FUENTE-PROPIA.md`.
 */
export function FuenteView({ sinHueco }: { sinHueco?: boolean }) {
  const { fuentes, cargado, anadir, quitar } = useFuentes();
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [error, setError] = useState("");
  const [activa, setActiva] = useState<FuentePropia | null>(null);
  const [sala, setSala] = useState("");
  const [salaActiva, setSalaActiva] = useState("");

  // Se resuelve mientras se escribe para poder avisar antes de guardar: con un
  // magnet sin réplica HTTP el motivo se lee ya, no después de dar a Añadir.
  const limpiaAhora = url.trim();
  const resuelta = limpiaAhora ? resolverFuente(limpiaAhora) : null;
  // El motivo de un enlace que no sirve se enseña mientras se escribe, igual
  // que el aviso de uno que sí: es cuando todavía se puede hacer algo con esa
  // información. Se calla mientras el texto va por la mitad y todavía no puede
  // ser válido —si no, "https:/" ya acusaría de error a media palabra.
  const escribiendoAun = !/^(magnet:\?|https?:\/\/\S)/i.test(limpiaAhora);
  const aviso = resuelta?.ok ? resuelta.aviso : escribiendoAun ? "" : (resuelta?.motivo ?? "");
  const firmado = resuelta?.ok ? esEnlaceFirmado(resuelta.url) : false;

  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();
    const decision = resolverFuente(url);
    if (!decision.ok) {
      // Un enlace que no se puede reproducir no entra en la lista: dejarlo
      // guardado solo aplaza el mismo fallo a mañana, ya sin la explicación.
      setError(decision.motivo);
      return;
    }
    setError("");
    setActiva(anadir(decision.url, titulo, decision.magnet));
    setUrl("");
    setTitulo("");
  };

  return (
    <div className={`screen tv-safe fuente ${sinHueco ? "sin-hueco" : ""}`}>
      <section className="section-heading library-heading">
        <div className="library-title-block">
          <p className="eyebrow">Un enlace tuyo, y la única sección con Ver en familia</p>
          <h2>Mi enlace</h2>
        </div>
      </section>

      <form className="fuente-alta" onSubmit={enviar}>
        <div className="fuente-campo">
          <Link2 aria-hidden="true" />
          {/* `type="text"` y no `type="url"`: la validación nativa de `url`
              rechaza `magnet:` en varios navegadores, y el protocolo ya lo
              comprueba `resolverFuente` antes de que nada llegue a un `src`. */}
          <input
            type="text"
            inputMode="url"
            data-nav="input"
            value={url}
            onChange={(evento) => setUrl(evento.target.value)}
            placeholder="https://…  (.mp4, .m3u8, .mkv) o magnet:?…"
            aria-label="Enlace del vídeo"
            required
          />
        </div>
        <input
          type="text"
          data-nav="input"
          className="fuente-nombre"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          placeholder="Nombre (opcional)"
          aria-label="Nombre para este enlace"
        />
        <button type="submit" data-nav="button" className="fuente-anadir">
          Añadir
        </button>
      </form>

      {error && (
        <p className="fuente-error" role="alert">
          {error}
        </p>
      )}
      {!error && aviso && <p className="fuente-aviso">{aviso}</p>}
      {!error && !aviso && firmado && (
        <p className="fuente-aviso">
          Este enlace lleva firma y caducidad: funcionará mientras el servidor lo dé por
          válido y dejará de hacerlo al expirar, sin avisar. Cuando pase, vuelve a copiarlo.
        </p>
      )}

      {activa && (
        <section className="fuente-reproductor">
          <h3>{activa.titulo}</h3>

          {/* La sala va **encima** del reproductor a propósito: hay que entrar
              antes de darle a reproducir, o cada casa arrancaría por su lado. */}
          <form
            className="fuente-sala"
            onSubmit={(evento) => {
              evento.preventDefault();
              setSalaActiva(normalizeRoomId(sala));
            }}
          >
            <Users aria-hidden="true" />
            <label htmlFor="fuente-sala">Ver en familia</label>
            <input
              id="fuente-sala"
              data-nav="input"
              value={sala}
              onChange={(evento) => setSala(evento.target.value)}
              placeholder="nombre de la sala"
            />
            <button type="submit" data-nav="button">
              {salaActiva ? "Cambiar sala" : "Entrar"}
            </button>
            <p>
              Quien abra esta misma pantalla con el mismo enlace y el mismo nombre de sala
              verá el vídeo sincronizado: play, pausa y saltos van juntos.
            </p>
          </form>

          <NativePlayer
            key={activa.id}
            streams={[{ label: activa.titulo, url: activa.url, type: "auto" }]}
            title={activa.titulo}
            roomId={salaActiva || undefined}
          />
        </section>
      )}

      <section className="ficha-seccion">
        <h2>Guardados en este dispositivo</h2>
        {!cargado ? null : fuentes.length === 0 ? (
          <p className="ficha-vacio">
            Todavía no has añadido ningún enlace. Pega uno arriba y aparecerá aquí.
          </p>
        ) : (
          <div className="fuente-lista">
            {fuentes.map((fuente) => (
              <div
                key={fuente.id}
                className={`fuente-fila ${activa?.id === fuente.id ? "is-active" : ""}`}
              >
                <button
                  type="button"
                  data-nav="row"
                  className="fuente-fila-abrir"
                  onClick={() => setActiva(fuente)}
                >
                  <span className="fuente-fila-icono">
                    <Play aria-hidden="true" />
                  </span>
                  <span className="fuente-fila-texto">
                    <strong>{fuente.titulo}</strong>
                    <span>{fuente.url}</span>
                  </span>
                  <em className="fuente-clase">{fuente.clase}</em>
                </button>
                <button
                  type="button"
                  data-nav="button"
                  className="fuente-quitar"
                  aria-label={`Quitar ${fuente.titulo}`}
                  onClick={() => {
                    if (activa?.id === fuente.id) setActiva(null);
                    quitar(fuente.id);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
