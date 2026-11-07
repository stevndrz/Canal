"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Clapperboard, Link2, Play, Plus, Trash2, VolumeX } from "lucide-react";
import { useFuentes } from "@/hooks/use-fuentes";
import { useNuestrasPeliculas } from "@/hooks/use-nuestras-peliculas";
import { useVerJuntos } from "@/hooks/use-ver-juntos";
import { estabaDentro, guardarAparato, leerAparato, recordarDentro, type Aparato } from "@/lib/ver-juntos/recordar";
import { CuentaAtras, SalaJuntos } from "./sala-juntos";
import { VincularAparato } from "./vincular-aparato";
import { claveDeFuente } from "@/lib/progreso";
import { esEnlaceFirmado, resolverFuente } from "@/lib/fuente-propia/url";
import type { SubtitleTrack } from "@/lib/catalog/types";
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
/**
 * Lo que puede sonar aquí: un enlace guardado, una de «Nuestras películas» o
 * lo que manda la sala. Las tres cosas tienen esta forma.
 */
interface Reproducible {
  id: string;
  titulo: string;
  url: string;
  subtitulos?: SubtitleTrack[];
}

function duracionCorta(segundos?: number): string {
  if (!segundos) return "";
  const minutos = Math.round(segundos / 60);
  return minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos} min`;
}

export function FuenteView({ sinHueco }: { sinHueco?: boolean }) {
  const { fuentes, cargado, anadir, quitar } = useFuentes();
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [error, setError] = useState("");
  const [activa, setActiva] = useState<Reproducible | null>(null);
  const nuestras = useNuestrasPeliculas();

  /**
   * Ver juntos: una sola sala para la casa. Este aparato se vincula una vez
   * (PIN + nombre) y desde ahí solo hay que «Entrar». Dentro, lo que suena es
   * la película de la sala —la última que eligió cualquiera— y no lo local.
   */
  const [aparato, setAparato] = useState<Aparato | null>(null);
  const [dentro, setDentro] = useState(false);
  /** Hasta leer el almacenamiento no se sabe si pedir el PIN o «Entrar». */
  const [memoriaLeida, setMemoriaLeida] = useState(false);
  useEffect(() => {
    // `localStorage` no existe en el render de servidor: leerlo en el primer
    // render rompía la hidratación. Mismo patrón que `use-fuentes.ts`.
    const guardado = leerAparato();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAparato(guardado);
    // Si se salió de Mi enlace estando dentro, al volver se entra sola.
    setDentro(Boolean(guardado) && estabaDentro());
    setMemoriaLeida(true);
  }, []);
  useEffect(() => {
    if (memoriaLeida) recordarDentro(dentro);
  }, [dentro, memoriaLeida]);
  const juntos = useVerJuntos({
    aparato,
    dentro,
    alPerderVinculo: useCallback(() => {
      guardarAparato(null);
      setAparato(null);
      setDentro(false);
    }, []),
  });
  const enSala = dentro && juntos.estado !== "fuera";
  const elegirEnSala = juntos.elegir;

  /** Elegir algo: dentro de la sala, es la película de todos. */
  const elegir = useCallback(
    (item: Reproducible) => {
      if (enSala) elegirEnSala({ url: item.url, titulo: item.titulo, subtitulos: item.subtitulos });
      else setActiva(item);
    },
    [enSala, elegirEnSala],
  );

  /** Lo que suena: la película de la sala si estás dentro; lo tuyo si no. */
  const deLaSala = juntos.pelicula?.video;
  const enPantalla: Reproducible | null = enSala
    ? deLaSala
      ? { id: `sala-${deLaSala.url}`, titulo: deLaSala.titulo || "Ver juntos", url: deLaSala.url, subtitulos: deLaSala.subtitulos }
      : null
    : activa;
  const idElegida = enPantalla?.url;

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
  const urlEnPantalla = enPantalla?.url ?? "";
  const tituloEnPantalla = enPantalla?.titulo ?? "";
  // Por valor y no por identidad, por lo mismo: el objeto del invitado se
  // reconstruye en cada render.
  const subtitulosEnPantalla = JSON.stringify(enPantalla?.subtitulos ?? []);
  const streamsActivos = useMemo(
    () =>
      urlEnPantalla
        ? [
            {
              label: tituloEnPantalla,
              url: urlEnPantalla,
              type: "auto" as const,
              subtitles: JSON.parse(subtitulosEnPantalla) as SubtitleTrack[],
            },
          ]
        : [],
    [urlEnPantalla, tituloEnPantalla, subtitulosEnPantalla],
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
    elegir(anadir(decision.url, titulo, decision.magnet));
    setUrl("");
    setTitulo("");
  };

  return (
    /* `ContenedorVista` pone `--margen` a los lados a todos los anchos. Antes
       la vista solo limitaba el ancho a 1.100 px, así que por debajo de eso el
       título, el campo y «Añadir» tocaban los dos bordes de la pantalla. */
    <ContenedorVista ancho="medio" className={`screen tv-safe fuente ${sinHueco ? "sin-hueco" : ""}`}>
      <EncabezadoSeccion talla="pagina" sobretitulo="Pega el enlace de un vídeo y míralo aquí" titulo="Mi enlace" />

      {/* «Nuestras películas»: lo que sube `scripts/peliculas/subir-pelicula.ps1`
          a R2. Va lo primero porque es el camino de Ver juntos: un clic y ya
          tiene sus audios y subtítulos, sin pegar nada. */}
      {nuestras.configurado && (
        <section className="fuente-guardados" aria-labelledby="nuestras-titulo">
          <EncabezadoSeccion
            talla="seccion"
            nivel={3}
            idTitulo="nuestras-titulo"
            sobretitulo="Para ver juntos, con sus audios y subtítulos"
            titulo="Nuestras películas"
          />
          {!nuestras.listo ? null : nuestras.fallo ? (
            <Aviso tono="aviso" className="fuente-aviso">
              No se pudo leer la lista de películas. Si acabas de crear el bucket, revisa su CORS (ver
              docs/PELICULAS-JUNTOS.md).
            </Aviso>
          ) : nuestras.peliculas.length === 0 ? (
            <EstadoVacio
              icono={<Clapperboard />}
              titulo="Todavía no hay películas"
              texto="Arrastra una sobre subir-pelicula.cmd en tu PC y aparecerá aquí, en todos los aparatos."
            />
          ) : (
            <ul className="fuente-lista">
              {nuestras.peliculas.map((pelicula) => {
                const id = `nuestra-${pelicula.id}`;
                const elegida = idElegida === pelicula.url;
                const detalle = [
                  duracionCorta(pelicula.duracion),
                  pelicula.subtitulos.length > 0 ? `${pelicula.subtitulos.length} subtítulos` : "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={pelicula.id} className={`fuente-fila ${elegida ? "is-active" : ""}`}>
                    <button
                      type="button"
                      data-nav="row"
                      className="fuente-fila-abrir"
                      aria-current={elegida ? "true" : undefined}
                      onClick={() => elegir({ id, titulo: pelicula.titulo, url: pelicula.url, subtitulos: pelicula.subtitulos })}
                    >
                      <span className="fuente-fila-icono">
                        <Play aria-hidden="true" />
                      </span>
                      <span className="fuente-fila-texto">
                        <strong>{pelicula.titulo}</strong>
                        {detalle && <span>{detalle}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

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

      {memoriaLeida &&
        juntos.estado !== "sin-configurar" &&
        (aparato ? (
          <SalaJuntos
            yo={{ id: aparato.id, nombre: aparato.nombre }}
            estado={juntos.estado}
            miembros={juntos.miembros}
            conocidos={juntos.conocidos}
            pelicula={juntos.pelicula}
            alEntrar={() => setDentro(true)}
            alEmpezar={juntos.empezar}
            alSalir={() => setDentro(false)}
          />
        ) : (
          <VincularAparato
            alVincular={(nuevo) => {
              guardarAparato(nuevo);
              setAparato(nuevo);
              setDentro(true);
            }}
          />
        ))}
      <CuentaAtras cuenta={juntos.cuenta} />

      {enPantalla && (
        <section className="fuente-reproductor" aria-label={`Reproduciendo ${enPantalla.titulo}`}>
          <EncabezadoSeccion talla="seccion" sobretitulo="Reproduciendo" titulo={enPantalla.titulo} nivel={3} />

          <NativePlayer
            key={enPantalla.id}
            streams={streamsActivos}
            title={enPantalla.titulo}
            // En la sala solo retoma quien dirige: en los demás, su posición
            // guardada provocaría un salto de ida y vuelta.
            claveProgreso={enSala && !juntos.dirijo ? undefined : claveDeFuente(enPantalla.id)}
            alVideo={enSala ? juntos.alVideo : undefined}
            superpuesto={
              juntos.necesitaToque ? (
                <button type="button" data-nav="button" className="atv-sala-aviso" onClick={juntos.unirse}>
                  <Play aria-hidden="true" />
                  Toca para unirte a la sala
                </button>
              ) : juntos.silenciadoPorSala ? (
                <button type="button" data-nav="button" className="atv-sala-aviso" onClick={juntos.activarSonido}>
                  <VolumeX aria-hidden="true" />
                  Toca para activar el sonido
                </button>
              ) : null
            }
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
                className={`fuente-fila ${idElegida === fuente.url ? "is-active" : ""}`}
              >
                <button
                  type="button"
                  data-nav="row"
                  className="fuente-fila-abrir"
                  aria-current={idElegida === fuente.url ? "true" : undefined}
                  onClick={() => elegir(fuente)}
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
