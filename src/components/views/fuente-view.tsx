"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { Link2, Play, Plus, Trash2 } from "lucide-react";
import { useFuentes } from "@/hooks/use-fuentes";
import { claveDeFuente } from "@/lib/progreso";
import { esEnlaceFirmado, resolverFuente } from "@/lib/fuente-propia/url";
import type { FuentePropia } from "@/lib/fuente-propia/types";
import {
  Aviso,
  Boton,
  BotonIcono,
  Campo,
  ContenedorVista,
  EncabezadoSeccion,
  EstadoVacio,
} from "@/components/ui";

/** Arrastra hls.js: solo se descarga cuando hay algo que reproducir aquí. */
const NativePlayer = dynamic(() => import("@/components/native-player"), {
  ssr: false,
  loading: () => <div className="fuente-marco is-cargando" />,
});

/**
 * Mi enlace: la tercera vía de reproducción.
 *
 * Por qué aquí sí hay controles completos, y no en las otras dos:
 *
 *  - **Canales** es señal en directo: no se puede pausar ni buscar en una
 *    emisión, así que la barra de progreso no tiene sentido ahí.
 *  - **Películas** se reproducen dentro del iframe de un proveedor externo.
 *    Ese `<video>` vive en otro dominio: desde aquí no se puede leer su tiempo
 *    ni controlarlo. No es difícil, es imposible.
 *  - **Aquí** el `<video>` es nuestro, con su tiempo y sus controles al
 *    alcance.
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

  /**
   * Identidad estable para el reproductor: el efecto de carga rearranca la
   * emisión cuando cambia el objeto `stream`, así que recrear el array en
   * cada render reiniciaría el vídeo con cada tecla del formulario de arriba.
   */
  const streamsActivos = useMemo(
    () => (activa ? [{ label: activa.titulo, url: activa.url, type: "auto" as const }] : []),
    [activa],
  );

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
    /* `ContenedorVista` pone `--margen` a los lados a todos los anchos. Antes
       la vista solo limitaba el ancho a 1.100 px, así que por debajo de eso el
       título, el campo y «Añadir» tocaban los dos bordes de la pantalla. */
    <ContenedorVista ancho="medio" className={`screen tv-safe fuente ${sinHueco ? "sin-hueco" : ""}`}>
      <EncabezadoSeccion talla="pagina" sobretitulo="Pega el enlace de un vídeo y míralo aquí" titulo="Mi enlace" />

      <form className="fuente-alta" onSubmit={enviar} noValidate>
        {/* `type="text"` y no `type="url"`: la validación nativa de `url`
            rechaza `magnet:` en varios navegadores, y el protocolo ya lo
            comprueba `resolverFuente` antes de que nada llegue a un `src`.
            Sin `autoFocus`: dentro de un campo las flechas del mando no
            navegan, y la vista quedaría atrapada nada más entrar. */}
        <Campo
          className="fuente-enlace"
          tamano="lg"
          etiqueta="Enlace del vídeo"
          icono={<Link2 />}
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={url}
          onChange={(evento) => {
            setUrl(evento.target.value);
            // El error era del enlace de antes: al corregirlo, sobra.
            if (error) setError("");
          }}
          placeholder="https://… o magnet:…"
          limpiable
          onLimpiar={() => setUrl("")}
          invalido={Boolean(error)}
          required
        />
        <Campo
          className="fuente-nombre"
          tamano="lg"
          etiqueta="Nombre (opcional)"
          type="text"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          placeholder="Ej.: Noticias"
        />
        <Boton type="submit" variante="primario" tamano="lg" icono={<Plus />} className="fuente-anadir">
          Añadir
        </Boton>
      </form>

      {/* Un solo aviso a la vez, el más importante primero: si el enlace no
          sirve, lo demás da igual. */}
      {error ? (
        <Aviso tono="peligro" className="fuente-aviso">
          {error}
        </Aviso>
      ) : aviso ? (
        <Aviso tono="aviso" className="fuente-aviso">
          {aviso}
        </Aviso>
      ) : firmado ? (
        <Aviso tono="aviso" className="fuente-aviso" titulo="Este enlace caduca">
          Lleva firma y caducidad: funcionará mientras el servidor lo dé por válido y dejará de
          hacerlo al expirar, sin avisar. Cuando pase, vuelve a copiarlo.
        </Aviso>
      ) : null}

      {activa && (
        <section className="fuente-reproductor" aria-label={`Reproduciendo ${activa.titulo}`}>
          <EncabezadoSeccion talla="seccion" sobretitulo="Reproduciendo" titulo={activa.titulo} nivel={3} />

          <NativePlayer
            key={activa.id}
            streams={streamsActivos}
            title={activa.titulo}
            claveProgreso={claveDeFuente(activa.id)}
          />
        </section>
      )}

      <section className="fuente-guardados" aria-labelledby="fuente-guardados-titulo">
        <EncabezadoSeccion
          talla="seccion"
          titulo="Guardados en este dispositivo"
          idTitulo="fuente-guardados-titulo"
        />
        {!cargado ? null : fuentes.length === 0 ? (
          <EstadoVacio
            icono={<Link2 />}
            titulo="Todavía no hay enlaces"
            texto="Pega uno arriba y aparecerá aquí, listo para volver a verlo."
          />
        ) : (
          <ul className="fuente-lista">
            {fuentes.map((fuente) => (
              <li
                key={fuente.id}
                className={`fuente-fila ${activa?.id === fuente.id ? "is-active" : ""}`}
              >
                <button
                  type="button"
                  data-nav="row"
                  className="fuente-fila-abrir"
                  aria-current={activa?.id === fuente.id ? "true" : undefined}
                  onClick={() => setActiva(fuente)}
                >
                  <span className="fuente-fila-icono">
                    <Play aria-hidden="true" />
                  </span>
                  <span className="fuente-fila-texto">
                    <strong>{fuente.titulo}</strong>
                    <span>{fuente.url}</span>
                  </span>
                  <span className="fuente-clase">{fuente.clase}</span>
                </button>
                <BotonIcono
                  variante="fantasma"
                  className="fuente-quitar"
                  aria-label={`Quitar ${fuente.titulo}`}
                  icono={<Trash2 />}
                  onClick={() => {
                    if (activa?.id === fuente.id) setActiva(null);
                    quitar(fuente.id);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </ContenedorVista>
  );
}
