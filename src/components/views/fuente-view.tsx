"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Link2, Play, Trash2, Users } from "lucide-react";
import { useFuentes } from "@/hooks/use-fuentes";
import { avisoDeClase, claseDeUrl, esEnlaceFirmado, urlUtilizable } from "@/lib/fuente-propia/url";
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

  const limpiaAhora = url.trim();
  const aviso = limpiaAhora ? avisoDeClase(claseDeUrl(limpiaAhora)) : "";
  const firmado = limpiaAhora ? esEnlaceFirmado(limpiaAhora) : false;

  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();
    const limpia = url.trim();
    if (!urlUtilizable(limpia)) {
      // El protocolo se valida antes de que el enlace llegue a un `src`.
      setError("Tiene que ser un enlace http:// o https://");
      return;
    }
    setError("");
    setActiva(anadir(limpia, titulo));
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
          <input
            type="url"
            data-nav="input"
            value={url}
            onChange={(evento) => setUrl(evento.target.value)}
            placeholder="https://…  (.mp4, .m3u8, .mkv, o un enlace directo)"
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
