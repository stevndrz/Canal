"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clapperboard, History, Link2, MonitorUp, Play, Plus, Trash2, Users, VolumeX } from "lucide-react";
import { useFuentes } from "@/hooks/use-fuentes";
import { useEstadoPc } from "@/hooks/use-estado-pc";
import { useNuestrasPeliculas } from "@/hooks/use-nuestras-peliculas";
import { useVerJuntos } from "@/hooks/use-ver-juntos";
import { useArte, useAudios } from "@/hooks/use-portada";
import { esTeclaAtras } from "@/hooks/use-spatial-nav";
import {
  apuntarVistaJuntos,
  crearIdAparato,
  guardarPerfil,
  leerPerfil,
  leerSalaRecordada,
  leerUltimaSala,
  leerVistasJuntos,
  recordarSala,
  recordarUltimaSala,
  type Perfil,
} from "@/lib/ver-juntos/recordar";
import { dondeRetomar, reloj, resumen, type VistaJuntos } from "@/lib/ver-juntos/historial";
import { crearCodigoSala } from "@/lib/ver-juntos/sala";
import { duracionCorta } from "@/lib/ver-juntos/portada";
import { CabeceraJuntos, CuentaAtras, Estante, Halo, Hoja, Portada, Presencia, presencia } from "./sala-cine";
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
 * empezar, volver a la película). Encima de todo, el estante de «Nuestras películas»:
 * lo que hay para ver es lo primero que se lee. Pegar un
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
  /**
   * A pantalla completa (la tele, al arrancar). En PC y teléfono el
   * reproductor se queda en la página, en modo teatro, con su propio botón de
   * pantalla completa.
   */
  const [inmersivo, setInmersivo] = useState(false);
  const [hoja, setHoja] = useState<null | "enlace" | "alias" | "codigo">(null);
  /** Lo que se iba a hacer cuando se pidió el alias: se sigue al guardarlo. */
  const [trasAlias, setTrasAlias] = useState<null | "crear" | "entrar">(null);
  const nuestras = useNuestrasPeliculas();
  /** Qué está haciendo el PC que sube las películas («Convirtiendo Buddy · 62 %»). */
  const pc = useEstadoPc();
  /**
   * El estante va arriba del todo hasta que algo empieza a reproducirse en la
   * página (PC y teléfono): ahí se recoge para dejarle el ancho al reproductor.
   */
  const [estanteVisible, setEstanteVisible] = useState(true);
  /** Se pulsó «Cambiar película»: el estante sale aunque ya haya una elegida. */
  const [cambiando, setCambiando] = useState(false);
  const estanteRef = useRef<HTMLButtonElement | null>(null);
  const principalRef = useRef<HTMLButtonElement | null>(null);
  /**
   * Tras elegir en el estante se vuelve a la portada, con el foco en el botón
   * principal: lo siguiente es «Empezar», y con el mando no se veía que la
   * película había cambiado allá arriba.
   */
  const volverALaPortada = useCallback(() => {
    // Con el estante arriba, el botón puede quedar bajo el borde en una tele:
    // se desplaza lo justo para verlo, no al principio de la página.
    window.setTimeout(() => {
      principalRef.current?.focus({ preventScroll: true });
      principalRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
  }, []);
  /** «Cambiar película» y «Elegir película» llevan el foco al estante. */
  const irAlEstante = useCallback(() => {
    setEstanteVisible(true);
    setCambiando(true);
    // Si estaba recogido, el estante existe a partir del siguiente render.
    window.setTimeout(() => {
      estanteRef.current?.focus();
      estanteRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 50);
  }, []);

  /**
   * Ver juntos: quien crea la sala recibe un código de cuatro cifras y el otro
   * lo escribe. Cada uno con su alias, elegido una vez. Dentro, lo que suena
   * es la película de la sala —la última que eligió cualquiera— y no lo local.
   */
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [codigo, setCodigoSala] = useState("");
  /** La sala de la última vez: «Volver a la sala 4821», sin dictarse el código. */
  const [ultimaSala, setUltimaSala] = useState("");
  /** Lo visto juntos en este aparato, y por dónde iba cada cosa. */
  const [vistas, setVistas] = useState<VistaJuntos[]>([]);
  /** «Ayer», «hace 3 días»: contado desde que se abrió la pantalla. */
  const [ahora, setAhora] = useState(0);
  useEffect(() => {
    // `localStorage` no existe en el render de servidor: leerlo en el primer
    // render rompía la hidratación. Mismo patrón que `use-fuentes.ts`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerfil(leerPerfil());
    // Si se salió de Mi enlace estando en una sala, al volver se entra sola.
    setCodigoSala(leerSalaRecordada()?.codigo ?? "");
    setUltimaSala(leerUltimaSala());
    setVistas(leerVistasJuntos());
    setAhora(Date.now());
  }, []);
  const ponerCodigo = useCallback((nuevo: string) => {
    setCodigoSala(nuevo);
    recordarSala(nuevo ? { codigo: nuevo, pelicula: null } : null);
    if (nuevo) {
      recordarUltimaSala(nuevo);
      setUltimaSala(nuevo);
    }
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
  /**
   * El reproductor está siempre que hay película: es lo principal de esta
   * pantalla. Fuera de la sala, darle a reproducir es verla aquí solo.
   */
  const enPantalla = portada;
  /**
   * Una misma película tiene que ser el mismo reproductor dentro y fuera de
   * la sala (si no, al entrar se recargaba) y guardar su progreso con la
   * misma clave de siempre: la de «Nuestras películas» si está en el estante.
   */
  const delEstante = nuestras.peliculas.find((p) => p.url === portada?.url);
  const claveVideo = delEstante ? `nuestra-${delEstante.id}` : (portada?.id ?? "");

  /**
   * Quien crea la sala pone la película que tenía en la portada: así, al
   * entrar el otro, ya le llega, sin tener que elegirla otra vez.
   */
  const ponerAlConectarRef = useRef<Reproducible | null>(null);
  /**
   * Al VOLVER a una sala puede haber ya alguien dentro con su película: la de
   * este aparato solo se pone si la sala estaba vacía.
   */
  const soloSiVaciaRef = useRef(false);
  const conectada = juntos.estado === "conectada";
  const haySoloUno = juntos.miembros.length <= 1;
  useEffect(() => {
    const pendiente = ponerAlConectarRef.current;
    if (!conectada || !pendiente) return;
    ponerAlConectarRef.current = null;
    if (soloSiVaciaRef.current && !haySoloUno) return;
    if (!juntos.pelicula) elegirEnSala({ url: pendiente.url, titulo: pendiente.titulo, subtitulos: pendiente.subtitulos });
  }, [conectada, haySoloUno, juntos.pelicula, elegirEnSala]);

  const titulosEstante = useMemo(() => nuestras.peliculas.map((p) => p.titulo), [nuestras.peliculas]);
  const tituloPortada = portada?.titulo ?? "";
  const arte = useArte(
    useMemo(() => (tituloPortada ? [...titulosEstante, tituloPortada] : titulosEstante), [titulosEstante, tituloPortada]),
  );
  const audios = useAudios(portada?.url);
  const pildoras = [
    duracionCorta(delEstante?.duracion),
    audios.length > 0 ? audios.join(" · ") : "",
    portada
      ? portada.subtitulos?.length
        ? portada.subtitulos.map((s) => s.label).join(" · ")
        : "Sin subtítulos"
      : "",
  ].filter(Boolean);

  // --- El vídeo: en la tele, a pantalla completa en cuanto arranca -----------
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
      // Arrancó —por la cuenta atrás, por el otro o a mano—. En la tele, a
      // pantalla completa: desde el sofá no se ve una película a media página.
      if (document.documentElement.dataset.pantalla === "tv") setInmersivo(true);
      // En PC y teléfono se ve en la página: el estante se recoge y el
      // reproductor crece a todo el ancho. Vuelve con «Cambiar película».
      else setEstanteVisible(false);
    };
    const alPausa = () => setReproduciendo(false);
    video.addEventListener("play", alPlay);
    video.addEventListener("pause", alPausa);
    return () => {
      video.removeEventListener("play", alPlay);
      video.removeEventListener("pause", alPausa);
    };
  }, [video]);
  // --- Seguir viendo juntos: por dónde va la película de la sala -------------
  const [tiempoVideo, setTiempoVideo] = useState(0);
  const conQuienRef = useRef<string[]>([]);
  const urlSala = enSala ? (portada?.url ?? "") : "";
  const tituloSala = portada?.titulo ?? "";
  useEffect(() => {
    if (!video) return;
    let ultimo = 0;
    const apuntarAhora = () => {
      setTiempoVideo(video.currentTime);
      // Solo lo que se ve en una sala, y nunca el segundo 0 de antes de
      // empezar: pisaría el «iban por 47:10» de ayer.
      if (!urlSala || video.currentTime < 1) return;
      ultimo = Date.now();
      setVistas(
        apuntarVistaJuntos({
          url: urlSala,
          titulo: tituloSala,
          posicion: video.currentTime,
          duracion: Number.isFinite(video.duration) ? video.duration : 0,
          visto: ultimo,
          con: conQuienRef.current,
        }),
      );
    };
    const alAvanzar = () => {
      if (Date.now() - ultimo >= 5000) apuntarAhora();
    };
    video.addEventListener("timeupdate", alAvanzar);
    video.addEventListener("pause", apuntarAhora);
    video.addEventListener("seeked", apuntarAhora);
    return () => {
      video.removeEventListener("timeupdate", alAvanzar);
      video.removeEventListener("pause", apuntarAhora);
      video.removeEventListener("seeked", apuntarAhora);
    };
  }, [video, urlSala, tituloSala]);

  const escenarioVisible = inmersivo && Boolean(enPantalla);
  const fondo = portada ? (arte[portada.titulo]?.fondo ?? null) : null;

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
    // Queda en la portada, en el reproductor: un enlace propio se ve igual
    // que una de «Nuestras películas».
    elegir(item);
    setHoja(null);
    volverALaPortada();
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
  const personas = perfil && dentro ? presencia(perfil, juntos.miembros, enSala, juntos.ausentes) : [];
  const otros = personas.filter((p) => !p.soyYo && p.id !== "?");
  const otroAqui = otros.find((p) => p.aqui);
  const otroNombre = otroAqui?.nombre ?? null;
  const acompanado = Boolean(otroAqui);
  const nombresOtros = otros.filter((p) => p.aqui).map((p) => p.nombre).join("\u0000");
  useEffect(() => {
    conQuienRef.current = nombresOtros ? nombresOtros.split("\u0000") : [];
  }, [nombresOtros]);
  /**
   * El segundo que ofrecer en «Retomar», si la sala dejó esta película a
   * medias y el vídeo no está ya ahí (quien dirige suele retomar solo).
   */
  const iban = enSala && portada ? dondeRetomar(vistas.find((v) => v.url === portada.url)) : null;
  const retomar = iban !== null && Math.abs(tiempoVideo - iban) > 5 ? iban : null;

  const crearSala = () => {
    soloSiVaciaRef.current = false;
    ponerAlConectarRef.current = portada;
    ponerCodigo(crearCodigoSala());
  };
  const volverALaSala = () => {
    soloSiVaciaRef.current = true;
    ponerAlConectarRef.current = portada;
    ponerCodigo(ultimaSala);
  };
  /** Sin alias no se entra: se pide primero y luego se sigue con lo que era. */
  const conAlias = (siguiente: "crear" | "entrar") => {
    if (!perfil) {
      setTrasAlias(siguiente);
      setHoja("alias");
    } else if (siguiente === "crear") crearSala();
    else setHoja("codigo");
  };

  type Paso = "ver" | "crear" | "elegir" | "volver" | "empezar" | "retomar";
  let principal: { texto: string; icono?: React.ReactNode; paso: Paso } | null = null;
  if (!salaDisponible) {
    if (portada && !reproduciendo) principal = { texto: "Ver ahora", icono: <Play />, paso: "ver" };
  } else if (!dentro) {
    principal = { texto: "Crear sala", icono: <Users />, paso: "crear" };
  } else if (!portada) {
    principal = { texto: "Elegir película", paso: "elegir" };
  } else if (reproduciendo) {
    // En modo teatro la película ya está a la vista: «volver» solo hace falta
    // si se salió de la pantalla completa.
    principal = inmersivo ? null : { texto: "Pantalla completa", icono: <Play />, paso: "volver" };
  } else if (conectada && retomar !== null) {
    principal = { texto: `Retomar en ${reloj(retomar)}`, icono: <Play />, paso: "retomar" };
  } else if (conectada) {
    principal = { texto: acompanado ? "Empezar" : "Empezar sin esperar", icono: <Play />, paso: "empezar" };
  }
  const empezarSala = juntos.empezar;
  const irASala = juntos.irA;
  const dar = (paso: Paso) => {
    if (paso === "ver") {
      // Dentro del toque, para que el navegador deje sonar el vídeo.
      video?.play().catch(() => {});
    } else if (paso === "crear") conAlias("crear");
    else if (paso === "elegir") irAlEstante();
    else if (paso === "volver") pantallaCompleta();
    else if (paso === "retomar" && retomar !== null) {
      // Primero todos a ese segundo, en pausa; luego la cuenta atrás de siempre.
      irASala(retomar);
      empezarSala();
    } else empezarSala();
  };

  /**
   * «Pantalla completa» de la portada: la de verdad, la del contenedor del
   * reproductor (como su propio botón); si el navegador no la da, el modo
   * inmersivo, que ocupa toda la ventana.
   */
  const pantallaCompleta = () => {
    const contenedor = video?.closest(".atv") as (HTMLElement & { webkitRequestFullscreen?: () => void }) | null;
    if (contenedor?.requestFullscreen) contenedor.requestFullscreen().catch(() => setInmersivo(true));
    else setInmersivo(true);
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

  /**
   * El estante es lo primero mientras se está eligiendo. Con la película de
   * la sala ya puesta —o si solo hay una— repetir su carátula encima de su
   * propio reproductor es ruido: se guarda hasta «Cambiar película».
   */
  const yaElegida = Boolean(portada) && (dentro || nuestras.peliculas.length <= 1);
  const mostrarEstante = nuestras.peliculas.length > 0 && (cambiando || (estanteVisible && !yaElegida));

  return (
    <div className={`screen tv-safe fuente cine ${sinHueco ? "sin-hueco" : ""}`}>
      <Portada
        fondo={fondo}
        sobretitulo=""
        titulo={portada?.titulo || "Elijan una película"}
        pildoras={pildoras}
        estante={
          mostrarEstante && (
            <Estante
              peliculas={nuestras.peliculas}
              arte={arte}
              elegida={portada?.url}
              primeroRef={estanteRef}
              // Fuera de la sala lo primero es elegir; dentro, «Empezar».
              entrada={!dentro}
              alElegir={(elegida) => {
                const p = nuestras.peliculas.find((x) => x.url === elegida);
                if (!p) return;
                elegir({ id: `nuestra-${p.id}`, titulo: p.titulo, url: p.url, subtitulos: p.subtitulos });
                setCambiando(false);
                volverALaPortada();
              }}
            />
          )
        }
        teatro={
          enPantalla && (
            <section
              className={`cine-teatro ${escenarioVisible ? "is-inmersivo" : ""}`}
              aria-label={`Reproductor: ${enPantalla.titulo}`}
            >
              <Halo video={video} poster={fondo} />
              <NativePlayer
                key={enPantalla.url}
                streams={streamsActivos}
                title={enPantalla.titulo}
                poster={fondo ?? undefined}
                inmersivo={escenarioVisible}
                // En la sala solo retoma quien dirige: en los demás, su
                // posición guardada provocaría un salto de ida y vuelta.
                claveProgreso={enSala && !juntos.dirijo ? undefined : claveDeFuente(claveVideo)}
                alVideo={alVideo}
                cabecera={
                  enSala && escenarioVisible ? (
                    <CabeceraJuntos otro={otroNombre} acompanado={acompanado} alSalir={() => setInmersivo(false)} />
                  ) : escenarioVisible ? (
                    <CabeceraJuntos otro={null} acompanado={false} alSalir={() => setInmersivo(false)} />
                  ) : (
                    // En modo teatro el título ya está encima del reproductor:
                    // repetirlo dentro sobra.
                    <span />
                  )
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
          )
        }
      >
        {dentro && (
          <div className="cine-sala">
            <Presencia personas={personas} />
            <p className="cine-sala-chip" aria-label={`Código de la sala: ${codigo.split("").join(" ")}`}>
              Sala <span className="cine-codigo">{codigo}</span>
            </p>
          </div>
        )}
        <div className="cine-acciones">
          {principal && (
            <button
              ref={principalRef}
              type="button"
              data-nav="button"
              data-nav-entrada={dentro || !mostrarEstante ? "" : undefined}
              className="cine-boton-principal" onClick={() => dar(principal.paso)}>
              {principal.icono}
              {principal.texto}
            </button>
          )}
          {salaDisponible && !dentro && ultimaSala && perfil && (
            <button type="button" data-nav="button" className="cine-boton-cristal" onClick={volverALaSala}>
              Volver a la sala {ultimaSala}
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
        {pc && !reproduciendo && (
          // Con la película en marcha sobra: solo interesa mientras se elige o se espera.
          <p className={`cine-estado cine-pc ${pc.tono === "activo" ? "text-tinta-1" : ""}`} role="status" data-tono={pc.tono}>
            <MonitorUp aria-hidden="true" className="mr-2 inline h-4 w-4" />
            {pc.texto}
          </p>
        )}
        <div className="cine-secundarias">
          {salaDisponible && !dentro && portada && !reproduciendo && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={() => video?.play().catch(() => {})}>
              Ver aquí solo
            </button>
          )}
          {conectada && retomar !== null && !reproduciendo && (
            <button
              type="button"
              data-nav="button"
              className="cine-boton-texto"
              onClick={() => {
                irASala(0);
                empezarSala();
              }}
            >
              Desde el principio
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
        nuestras.listo &&
        (nuestras.fallo ? (
          <Aviso tono="aviso" className="fuente-aviso">
            No se pudo leer la lista de películas. Si acabas de crear el bucket, revisa su CORS (ver
            docs/PELICULAS-JUNTOS.md).
          </Aviso>
        ) : nuestras.peliculas.length === 0 ? (
          <EstadoVacio
            icono={<Clapperboard />}
            titulo="Todavía no hay películas"
            texto="Deja una en la carpeta Descargas\Peliculas de tu PC y sincroniza: aparecerá aquí, en todos los aparatos."
          />
        ) : null)}

      {vistas.length > 0 && (
        <section className="cine-vistas" aria-labelledby="cine-vistas-titulo">
          <h3 id="cine-vistas-titulo" className="cine-estante-titulo">
            Vistas juntos
          </h3>
          <ul className="fuente-lista" aria-label="Vistas juntos">
            {vistas.slice(0, 6).map((vista) => {
              const enNube = nuestras.peliculas.find((p) => p.url === vista.url);
              const detalle = resumen(vista, Math.max(ahora, vista.visto));
              return (
                <li key={vista.url} className={`fuente-fila ${portada?.url === vista.url ? "is-active" : ""}`}>
                  <button
                    type="button"
                    data-nav="row"
                    className="fuente-fila-abrir"
                    // Una que ya se borró de la nube se recuerda, pero no se puede poner.
                    disabled={!enNube}
                    onClick={() => {
                      if (!enNube) return;
                      elegir({ id: `nuestra-${enNube.id}`, titulo: enNube.titulo, url: enNube.url, subtitulos: enNube.subtitulos });
                      volverALaPortada();
                    }}
                  >
                    <span className="fuente-fila-icono">
                      <History aria-hidden="true" />
                    </span>
                    <span className="fuente-fila-texto">
                      <strong>{vista.titulo || "Sin título"}</strong>
                      <span>{enNube ? detalle : `${detalle} · ya no está en la nube`}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="cine-pie">
        <button type="button" data-nav="button" className="cine-boton-pequeno" onClick={() => setHoja("enlace")}>
          <Link2 aria-hidden="true" />
          Usar un enlace
        </button>
      </div>

      <Hoja abierta={hoja === "alias"} titulo="¿Cómo te llamas?" alCerrar={() => setHoja(null)}>
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

    </div>
  );
}
