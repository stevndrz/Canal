"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, Link2, Play, Plus, Trash2, Users, VolumeX } from "lucide-react";
import { useFuentes } from "@/hooks/use-fuentes";
import { useNuestrasPeliculas } from "@/hooks/use-nuestras-peliculas";
import { useVerJuntos } from "@/hooks/use-ver-juntos";
import { useArte, useAudios } from "@/hooks/use-portada";
import { esTeclaAtras } from "@/hooks/use-spatial-nav";
import {
  crearIdAparato,
  guardarPerfil,
  leerPerfil,
  leerSalaRecordada,
  recordarSala,
  type Perfil,
} from "@/lib/ver-juntos/recordar";
import { crearCodigoSala } from "@/lib/ver-juntos/sala";
import { duracionCorta } from "@/lib/ver-juntos/portada";
import { CabeceraJuntos, CuentaAtras, Estante, Hoja, Portada, Presencia, presencia } from "./sala-cine";
import { ElegirAlias, TecladoCodigo } from "./entrar-sala";
import { claveDeFuente } from "@/lib/progreso";
import { esEnlaceFirmado, resolverFuente } from "@/lib/fuente-propia/url";
import type { SubtitleTrack } from "@/lib/catalog/types";
import { Aviso, Boton, BotonIcono, Campo, EstadoVacio } from "@/components/ui";

/** Arrastra hls.js: solo se descarga cuando hay algo que reproducir aquí. */
const NativePlayer = dynamic(() => import("@/components/native-player"), {
  ssr: false,
  loading: () => <div className="fuente-marco is-cargando" />,
});

/**
 * Mi enlace: «sala de cine para dos».
 *
 * La vista principal es la portada de la película de la sala, con quién está
 * y un solo botón que dice lo siguiente que toca (crear la sala, elegir,
 * empezar, volver a la película). Debajo, el estante de «Nuestras películas». Pegar un
 * enlace —la vía de siempre de Mi enlace— vive en una hoja aparte, a un botón.
 *
 * Por qué aquí sí hay controles completos, y no en Canales ni en Películas:
 * aquí el `<video>` es nuestro, con su tiempo y sus controles al alcance (en
 * Películas vive en el iframe de otro dominio). El contrato de los enlaces
 * está en `docs/FUENTE-PROPIA.md`.
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

export function FuenteView({ sinHueco }: { sinHueco?: boolean }) {
  const { fuentes, cargado, anadir, quitar } = useFuentes();
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [error, setError] = useState("");
  /** Lo elegido en este aparato fuera de la sala. */
  const [activa, setActiva] = useState<Reproducible | null>(null);
  /** Fuera de la sala, el reproductor solo se monta al pedir «Ver aquí». */
  const [verSolo, setVerSolo] = useState(false);
  const [inmersivo, setInmersivo] = useState(false);
  const [hoja, setHoja] = useState<null | "enlace" | "alias" | "codigo">(null);
  /** Lo que se iba a hacer cuando se pidió el alias: se sigue al guardarlo. */
  const [trasAlias, setTrasAlias] = useState<null | "crear" | "entrar">(null);
  const nuestras = useNuestrasPeliculas();
  const estanteRef = useRef<HTMLButtonElement | null>(null);
  const principalRef = useRef<HTMLButtonElement | null>(null);
  /**
   * Tras elegir en el estante se vuelve a la portada, con el foco en el botón
   * principal: lo siguiente es «Empezar», y con el mando no se veía que la
   * película había cambiado allá arriba.
   */
  const volverALaPortada = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => principalRef.current?.focus({ preventScroll: true }), 50);
  }, []);
  /** «Cambiar película» y «Elegir película» llevan el foco al estante. */
  const irAlEstante = useCallback(() => {
    estanteRef.current?.focus();
    estanteRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  /**
   * Ver juntos: quien crea la sala recibe un código de cuatro cifras y el otro
   * lo escribe. Cada uno con su alias, elegido una vez. Dentro, lo que suena
   * es la película de la sala —la última que eligió cualquiera— y no lo local.
   */
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [codigo, setCodigoSala] = useState("");
  useEffect(() => {
    // `localStorage` no existe en el render de servidor: leerlo en el primer
    // render rompía la hidratación. Mismo patrón que `use-fuentes.ts`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerfil(leerPerfil());
    // Si se salió de Mi enlace estando en una sala, al volver se entra sola.
    setCodigoSala(leerSalaRecordada()?.codigo ?? "");
  }, []);
  const ponerCodigo = useCallback((nuevo: string) => {
    setCodigoSala(nuevo);
    recordarSala(nuevo ? { codigo: nuevo, pelicula: null } : null);
  }, []);
  const juntos = useVerJuntos({ perfil, codigo });
  const dentro = Boolean(codigo);
  const salaDisponible = juntos.estado !== "sin-configurar";
  const enSala = dentro && juntos.estado !== "fuera" && juntos.estado !== "sin-configurar";
  const elegirEnSala = juntos.elegir;

  /** Elegir algo: dentro de la sala, es la película de todos. */
  const elegir = useCallback(
    (item: Reproducible) => {
      if (enSala) elegirEnSala({ url: item.url, titulo: item.titulo, subtitulos: item.subtitulos });
      else setActiva(item);
    },
    [enSala, elegirEnSala],
  );

  /**
   * La película de la portada: dentro, la de la sala; fuera, la que se eligió
   * aquí o, si no, la última que tuvo la sala (así se ve qué se va a ver antes
   * de entrar), o la primera del estante.
   */
  const deLaSala = juntos.pelicula?.video;
  const primera = nuestras.peliculas[0];
  const portada: Reproducible | null = enSala
    ? deLaSala
      ? { id: `sala-${deLaSala.url}`, titulo: deLaSala.titulo, url: deLaSala.url, subtitulos: deLaSala.subtitulos }
      : null
    : (activa ??
      (deLaSala
        ? { id: `sala-${deLaSala.url}`, titulo: deLaSala.titulo, url: deLaSala.url, subtitulos: deLaSala.subtitulos }
        : primera
          ? { id: `nuestra-${primera.id}`, titulo: primera.titulo, url: primera.url, subtitulos: primera.subtitulos }
          : null));
  const enPantalla = enSala || verSolo ? portada : null;

  /**
   * Quien crea la sala pone la película que tenía en la portada: así, al
   * entrar el otro, ya le llega, sin tener que elegirla otra vez.
   */
  const ponerAlConectarRef = useRef<Reproducible | null>(null);
  const conectada = juntos.estado === "conectada";
  useEffect(() => {
    const pendiente = ponerAlConectarRef.current;
    if (!conectada || !pendiente) return;
    ponerAlConectarRef.current = null;
    if (!juntos.pelicula) elegirEnSala({ url: pendiente.url, titulo: pendiente.titulo, subtitulos: pendiente.subtitulos });
  }, [conectada, juntos.pelicula, elegirEnSala]);

  const titulosEstante = useMemo(() => nuestras.peliculas.map((p) => p.titulo), [nuestras.peliculas]);
  const tituloPortada = portada?.titulo ?? "";
  const arte = useArte(
    useMemo(() => (tituloPortada ? [...titulosEstante, tituloPortada] : titulosEstante), [titulosEstante, tituloPortada]),
  );
  const audios = useAudios(portada?.url);
  const delCatalogo = nuestras.peliculas.find((p) => p.url === portada?.url);
  const pildoras = [
    duracionCorta(delCatalogo?.duracion),
    audios.length > 0 ? audios.join(" · ") : "",
    portada
      ? portada.subtitulos?.length
        ? portada.subtitulos.map((s) => s.label).join(" · ")
        : "Sin subtítulos"
      : "",
  ].filter(Boolean);

  // --- El vídeo: inmersivo en cuanto arranca ---------------------------------
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const alVideoSala = juntos.alVideo;
  const alVideo = useCallback(
    (v: HTMLVideoElement | null) => {
      alVideoSala(v);
      setVideo(v);
    },
    [alVideoSala],
  );
  useEffect(() => {
    if (!video) return;
    const alPlay = () => {
      setReproduciendo(true);
      // Arrancó —por la cuenta atrás, por el otro o a mano—: a pantalla completa.
      setInmersivo(true);
    };
    const alPausa = () => setReproduciendo(false);
    video.addEventListener("play", alPlay);
    video.addEventListener("pause", alPausa);
    return () => {
      video.removeEventListener("play", alPlay);
      video.removeEventListener("pause", alPausa);
    };
  }, [video]);
  const escenarioVisible = inmersivo && Boolean(enPantalla);

  // Atrás en el modo inmersivo vuelve a la portada (sin pausar: el otro sigue).
  useEffect(() => {
    if (!escenarioVisible) return;
    const alTecla = (evento: KeyboardEvent) => {
      if (!esTeclaAtras(evento)) return;
      evento.preventDefault();
      evento.stopImmediatePropagation();
      setInmersivo(false);
    };
    window.addEventListener("keydown", alTecla, true);
    return () => window.removeEventListener("keydown", alTecla, true);
  }, [escenarioVisible]);

  // --- El enlace propio, en su hoja ------------------------------------------
  // Se resuelve mientras se escribe para poder avisar antes de guardar: con un
  // magnet sin réplica HTTP el motivo se lee ya, no después de dar a Añadir.
  const limpiaAhora = url.trim();
  const resuelta = limpiaAhora ? resolverFuente(limpiaAhora) : null;
  // Se calla mientras el texto va por la mitad y todavía no puede ser válido:
  // si no, "https:/" ya acusaría de error a media palabra.
  const escribiendoAun = !/^(magnet:\?|https?:\/\/\S)/i.test(limpiaAhora);
  const aviso = resuelta?.ok ? resuelta.aviso : escribiendoAun ? "" : (resuelta?.motivo ?? "");
  const firmado = resuelta?.ok ? esEnlaceFirmado(resuelta.url) : false;

  /**
   * Identidad estable para el reproductor: el efecto de carga rearranca la
   * emisión cuando cambia el objeto `stream`, así que recrear el array en
   * cada render reiniciaría el vídeo con cada tecla del formulario.
   */
  const urlEnPantalla = enPantalla?.url ?? "";
  const tituloEnPantalla = enPantalla?.titulo ?? "";
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

  const reproducirEnlace = (item: Reproducible) => {
    elegir(item);
    if (!enSala) setVerSolo(true);
    setHoja(null);
  };

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
    reproducirEnlace(anadir(decision.url, titulo, decision.magnet));
    setUrl("");
    setTitulo("");
  };

  // --- El botón principal: lo siguiente que toca -------------------------------
  const personas = perfil && dentro ? presencia(perfil, juntos.miembros, enSala) : [];
  const otros = personas.filter((p) => !p.soyYo && p.id !== "?");
  const otroAqui = otros.find((p) => p.aqui);
  const otroNombre = otroAqui?.nombre ?? null;
  const acompanado = Boolean(otroAqui);

  const crearSala = () => {
    ponerAlConectarRef.current = portada;
    ponerCodigo(crearCodigoSala());
  };
  /** Sin alias no se entra: se pide primero y luego se sigue con lo que era. */
  const conAlias = (siguiente: "crear" | "entrar") => {
    if (!perfil) {
      setTrasAlias(siguiente);
      setHoja("alias");
    } else if (siguiente === "crear") crearSala();
    else setHoja("codigo");
  };

  type Paso = "ver" | "crear" | "elegir" | "volver" | "empezar";
  let principal: { texto: string; icono?: React.ReactNode; paso: Paso } | null = null;
  if (!salaDisponible) {
    if (portada) principal = { texto: "Ver ahora", icono: <Play />, paso: "ver" };
  } else if (!dentro) {
    principal = { texto: "Crear sala", icono: <Users />, paso: "crear" };
  } else if (!portada) {
    principal = { texto: "Elegir película", paso: "elegir" };
  } else if (reproduciendo) {
    principal = { texto: "Volver a la película", icono: <Play />, paso: "volver" };
  } else if (conectada) {
    principal = { texto: acompanado ? "Empezar" : "Empezar sin esperar", icono: <Play />, paso: "empezar" };
  }
  const empezarSala = juntos.empezar;
  const dar = (paso: Paso) => {
    if (paso === "ver") {
      setVerSolo(true);
      setInmersivo(true);
    } else if (paso === "crear") conAlias("crear");
    else if (paso === "elegir") irAlEstante();
    else if (paso === "volver") setInmersivo(true);
    else empezarSala();
  };

  const estadoSala = !dentro
    ? ""
    : juntos.estado === "conectando"
      ? "Entrando…"
      : juntos.estado === "error"
        ? "No se pudo conectar con la sala. Revisa la conexión."
        : !portada
          ? "Elijan una película del estante."
          : acompanado
            ? juntos.miembros.length > 2
              ? "Ya están todos."
              : "Ya están los dos."
            : `Pásale el código ${codigo} a la otra persona.`;

  const sobretitulo = enSala ? `Sala ${codigo}` : salaDisponible ? "Ver juntos" : "Nuestras películas";

  return (
    <div className={`screen tv-safe fuente cine ${sinHueco ? "sin-hueco" : ""}`}>
      <Portada
        fondo={portada ? (arte[portada.titulo]?.fondo ?? null) : null}
        sobretitulo={sobretitulo}
        titulo={portada?.titulo || "Elijan una película"}
        pildoras={pildoras}
      >
        {dentro && (
          <p className="cine-codigo mb-3 text-[length:var(--texto-3xl)] font-semibold tracking-[0.3em] text-tinta-1 tabular-nums" aria-label={`Código de la sala: ${codigo.split("").join(" ")}`}>
            {codigo}
          </p>
        )}
        {dentro && <Presencia personas={personas} />}
        <div className="cine-acciones">
          {principal && (
            <button
              ref={principalRef}
              type="button"
              data-nav="button"
              data-nav-entrada=""
              className="cine-boton-principal" onClick={() => dar(principal.paso)}>
              {principal.icono}
              {principal.texto}
            </button>
          )}
          {salaDisponible && !dentro && (
            <button type="button" data-nav="button" className="cine-boton-cristal" onClick={() => conAlias("entrar")}>
              Entrar con código
            </button>
          )}
          {portada && nuestras.peliculas.length > 1 && (
            <button type="button" data-nav="button" className="cine-boton-cristal" onClick={irAlEstante}>
              Cambiar película
            </button>
          )}
        </div>
        {estadoSala && (
          <p className="cine-estado" role="status">
            {estadoSala}
          </p>
        )}
        <div className="cine-secundarias">
          {salaDisponible && !dentro && portada && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={() => { setVerSolo(true); setInmersivo(true); }}>
              Ver aquí solo
            </button>
          )}
          {enSala && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={() => { ponerCodigo(""); setInmersivo(false); }}>
              Salir de la sala
            </button>
          )}
          {salaDisponible && perfil && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={() => setHoja("alias")}>
              Alias: {perfil.nombre}
            </button>
          )}
        </div>
      </Portada>

      {nuestras.configurado &&
        (!nuestras.listo ? null : nuestras.fallo ? (
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
          <Estante
            peliculas={nuestras.peliculas}
            arte={arte}
            elegida={portada?.url}
            primeroRef={estanteRef}
            alElegir={(elegida) => {
              const p = nuestras.peliculas.find((x) => x.url === elegida);
              if (!p) return;
              elegir({ id: `nuestra-${p.id}`, titulo: p.titulo, url: p.url, subtitulos: p.subtitulos });
              volverALaPortada();
            }}
          />
        ))}

      <div className="cine-pie">
        <button type="button" data-nav="button" className="cine-boton-pequeno" onClick={() => setHoja("enlace")}>
          <Link2 aria-hidden="true" />
          Usar un enlace
        </button>
      </div>

      <Hoja abierta={hoja === "alias"} titulo="Tu alias" alCerrar={() => setHoja(null)}>
        <ElegirAlias
          inicial={perfil?.nombre ?? ""}
          alGuardar={(nombre) => {
            const nuevo = { id: perfil?.id ?? crearIdAparato(), nombre };
            guardarPerfil(nuevo);
            setPerfil(nuevo);
            setHoja(null);
            const siguiente = trasAlias;
            setTrasAlias(null);
            if (siguiente === "crear") {
              ponerAlConectarRef.current = portada;
              ponerCodigo(crearCodigoSala());
            } else if (siguiente === "entrar") setHoja("codigo");
          }}
        />
      </Hoja>

      <Hoja abierta={hoja === "codigo"} titulo="Entrar con código" alCerrar={() => setHoja(null)}>
        <TecladoCodigo
          alCompletar={(escrito) => {
            ponerCodigo(escrito);
            setHoja(null);
          }}
        />
      </Hoja>

      <Hoja abierta={hoja === "enlace"} titulo="Usar un enlace" alCerrar={() => setHoja(null)}>
        <form className="fuente-alta" onSubmit={enviar} noValidate>
          {/* `type="text"` y no `type="url"`: la validación nativa de `url`
              rechaza `magnet:` en varios navegadores, y el protocolo ya lo
              comprueba `resolverFuente` antes de que nada llegue a un `src`. */}
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
            {enSala ? "Poner en la sala" : "Ver"}
          </Boton>
        </form>

        {/* Un solo aviso a la vez, el más importante primero. */}
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

        {cargado && fuentes.length === 0 ? (
          <EstadoVacio icono={<Link2 />} titulo="Todavía no hay enlaces" texto="Pega uno arriba y quedará guardado en este aparato." />
        ) : (
          <ul className="fuente-lista" aria-label="Guardados en este aparato">
            {fuentes.map((fuente) => (
              <li key={fuente.id} className={`fuente-fila ${portada?.url === fuente.url ? "is-active" : ""}`}>
                <button
                  type="button"
                  data-nav="row"
                  className="fuente-fila-abrir"
                  aria-current={portada?.url === fuente.url ? "true" : undefined}
                  onClick={() => reproducirEnlace(fuente)}
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
      </Hoja>

      <CuentaAtras cuenta={juntos.cuenta} />

      {/* El escenario se monta en cuanto hay algo que ver en la sala, aunque
          todavía no se vea: así «Empezar» encuentra el `<video>` y lo puede
          desbloquear dentro del toque (Safari), y la película carga durante
          la cuenta atrás. */}
      {enPantalla && (
        <section
          className={`cine-escenario ${escenarioVisible ? "is-visible" : ""}`}
          aria-label={`Reproduciendo ${enPantalla.titulo}`}
          aria-hidden={!escenarioVisible}
        >
          <NativePlayer
            key={enPantalla.id}
            streams={streamsActivos}
            title={enPantalla.titulo}
            inmersivo
            // En la sala solo retoma quien dirige: en los demás, su posición
            // guardada provocaría un salto de ida y vuelta.
            claveProgreso={enSala && !juntos.dirijo ? undefined : claveDeFuente(enPantalla.id)}
            alVideo={enSala ? alVideo : setVideo}
            cabecera={
              <CabeceraJuntos
                otro={enSala ? otroNombre : null}
                acompanado={enSala && acompanado}
                alSalir={() => setInmersivo(false)}
              />
            }
            superpuesto={
              <>
                {juntos.necesitaToque ? (
                  <button type="button" data-nav="button" className="atv-sala-aviso" onClick={juntos.unirse}>
                    <Play aria-hidden="true" />
                    Toca para unirte a la sala
                  </button>
                ) : juntos.silenciadoPorSala ? (
                  <button type="button" data-nav="button" className="atv-sala-aviso" onClick={juntos.activarSonido}>
                    <VolumeX aria-hidden="true" />
                    Toca para activar el sonido
                  </button>
                ) : null}
                {juntos.aviso && (
                  <span key={juntos.aviso.n} className="cine-aviso-otro" role="status">
                    {juntos.aviso.nombre} {juntos.aviso.que}
                  </span>
                )}
              </>
            }
          />
        </section>
      )}
    </div>
  );
}
