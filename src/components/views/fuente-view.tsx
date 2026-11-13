"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, Link2, MonitorUp, Play, Plus, Share2, Trash2, Users, VolumeX } from "lucide-react";
import { useFuentes } from "@/hooks/use-fuentes";
import { useEstadoPc } from "@/hooks/use-estado-pc";
import { useMantenerPantalla } from "@/hooks/use-sesion-de-medios";
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
import { enlaceDeSala, textoDeInvitacion } from "@/lib/ver-juntos/invitar";
import { crearCodigoSala, normalizarCodigo } from "@/lib/ver-juntos/sala";
import { duracionCorta } from "@/lib/ver-juntos/portada";
import { CabeceraJuntos, CuentaAtras, Estante, Halo, Hoja, Portada, Presencia, QrSala, SalaCargando, SalaVacia, iniciales, presencia } from "./sala-cine";
import { ElegirAlias, TecladoCodigo } from "./entrar-sala";
import { claveDeFuente } from "@/lib/progreso";
import { esEnlaceFirmado, resolverFuente } from "@/lib/fuente-propia/url";
import type { SubtitleTrack } from "@/lib/catalog/types";
import { Aviso, Boton, BotonIcono, Campo, EstadoVacio } from "@/components/ui";

/** Una película subida hace menos de esto, y sin empezar, lleva la etiqueta «Nueva». */
const NUEVA_MS = 7 * 24 * 3600_000;

/** Arrastra hls.js: solo se descarga cuando hay algo que reproducir aquí. */
const NativePlayer = dynamic(() => import("@/components/native-player"), {
  ssr: false,
  loading: () => <div className="fuente-marco is-cargando" />,
});

/**
 * Mi enlace: «sala de cine para dos».
 *
 * **Una pantalla, un siguiente paso.** La pantalla está en uno de cinco
 * estados y cada uno enseña solo lo que sirve, con un único botón principal:
 *
 *   vacío      no hay películas: qué es esto y cómo llega una («Cómo subir…»)
 *   eligiendo  el estante y la elegida («Crear sala», o «Volver a la sala»)
 *   esperando  dentro de la sala, sin empezar («Invitar», «Empezar»)
 *   viendo     solo el reproductor y quién está; lo demás se recoge
 *   pausa      quién pausó y por dónde van («Seguir»)
 *
 * Lo demás son botones de texto. Pegar un enlace —la vía de siempre de Mi
 * enlace— vive en una hoja aparte, a un botón.
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
  const [hoja, setHoja] = useState<null | "enlace" | "alias" | "codigo" | "como" | "bienvenida">(null);
  /** La bienvenida de quien entra por enlace: 1 es su nombre; 2 y 3, qué es esto. */
  const [pasoBienvenida, setPasoBienvenida] = useState<2 | 3>(2);
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
  /** Se llegó por un enlace de invitación (`/?sala=8047`) sin tener nombre todavía. */
  const [salaPorEnlace, setSalaPorEnlace] = useState("");
  /** Este aparato sabe compartir o copiar (un teléfono, un PC): la tele no. */
  const [puedeInvitar, setPuedeInvitar] = useState(false);
  /** Lo que pasó al pulsar «Invitar», si hay que decirlo («Enlace copiado»). */
  const [invitado, setInvitado] = useState("");
  useEffect(() => {
    // `localStorage` no existe en el render de servidor: leerlo en el primer
    // render rompía la hidratación. Mismo patrón que `use-fuentes.ts`.
    const guardado = leerPerfil();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerfil(guardado);
    setPuedeInvitar(
      document.documentElement.dataset.pantalla !== "tv" && (typeof navigator.share === "function" || Boolean(navigator.clipboard)),
    );
    // Un enlace de invitación entra directo; sin nombre todavía, se pide antes.
    const invitacion = normalizarCodigo(new URLSearchParams(window.location.search).get("sala") ?? "");
    if (invitacion) {
      // El código ya está leído: fuera de la barra, para que recargar no vuelva a entrar.
      window.history.replaceState(null, "", "/?vista=fuente");
      if (guardado) {
        recordarSala({ codigo: invitacion, pelicula: null });
        recordarUltimaSala(invitacion);
      } else {
        setSalaPorEnlace(invitacion);
        setHoja("alias");
      }
    }
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
  /**
   * La película ya arrancó alguna vez en esta visita: una parada es «en pausa»
   * («Seguir») y no «sin empezar» («Empezar», con su cuenta atrás). Se apunta
   * el `<video>`, que es uno por película: al cambiar de película deja de valer.
   */
  const [empezadoEn, setEmpezadoEn] = useState<HTMLVideoElement | null>(null);
  /** Quién pausó: un alias, o «tú». */
  const [quienPauso, setQuienPauso] = useState("");
  const avisoRef = useRef<{ nombre: string; que: string; cuando: number } | null>(null);
  const avisoSala = juntos.aviso;
  useEffect(() => {
    if (avisoSala) avisoRef.current = { nombre: avisoSala.nombre, que: avisoSala.que, cuando: Date.now() };
  }, [avisoSala]);
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
      setEmpezadoEn(video);
      // Arrancó —por la cuenta atrás, por el otro o a mano—. En la tele, a
      // pantalla completa: desde el sofá no se ve una película a media página.
      if (document.documentElement.dataset.pantalla === "tv") setInmersivo(true);
      // En PC y teléfono se ve en la página: el estante se recoge y el
      // reproductor crece a todo el ancho. Vuelve con «Cambiar película».
      else setEstanteVisible(false);
    };
    let trasPausa = 0;
    const alPausa = () => {
      setReproduciendo(false);
      // El aviso «Ana pausó» de la sala llega a la vez que la pausa: se espera
      // un instante para saber si fue otra persona o este mismo aparato.
      window.clearTimeout(trasPausa);
      trasPausa = window.setTimeout(() => {
        const aviso = avisoRef.current;
        setQuienPauso(aviso && aviso.que === "pausó" && Date.now() - aviso.cuando < 2000 ? aviso.nombre : "tú");
      }, 80);
    };
    video.addEventListener("play", alPlay);
    video.addEventListener("pause", alPausa);
    return () => {
      window.clearTimeout(trasPausa);
      video.removeEventListener("play", alPlay);
      video.removeEventListener("pause", alPausa);
    };
  }, [video]);
  // --- Seguir viendo juntos: por dónde va la película de la sala -------------
  const [tiempoVideo, setTiempoVideo] = useState(0);
  const conQuienRef = useRef<string[]>([]);
  // En la sala, la pantalla no se apaga en la pausa ni esperando a alguien
  // (con la película en marcha ya la mantiene el navegador). Cada minuto de
  // película, y cada play o pausa, renuevan el plazo.
  useMantenerPantalla(enSala && Boolean(portada), `${reproduciendo}|${Math.floor(tiempoVideo / 60)}`);
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

  // --- En qué estado está la pantalla, y su único botón principal -------------
  const empezada = Boolean(video) && empezadoEn === video;
  const hayPeliculas = nuestras.peliculas.length > 0;
  type Pantalla = "cargando" | "vacio" | "eligiendo" | "esperando" | "viendo" | "pausa";
  const pantalla: Pantalla = !portada
    ? nuestras.configurado && !nuestras.listo
      ? "cargando"
      : dentro && hayPeliculas
        ? "esperando"
        : "vacio"
    : reproduciendo
      ? "viendo"
      : empezada
        ? "pausa"
        : dentro
          ? "esperando"
          : "eligiendo";
  /** Hay una sala a la que volver sin dictarse el código: eso es lo siguiente. */
  const puedeVolver = salaDisponible && !dentro && Boolean(ultimaSala) && Boolean(perfil);

  type Paso = "ver" | "crear" | "elegir" | "volver-sala" | "empezar" | "retomar" | "invitar" | "seguir" | "como";
  interface Accion {
    texto: string;
    icono?: React.ReactNode;
    paso: Paso;
  }
  let principal: Accion | null = null;
  /** Arrancar, cuando el principal es «Invitar»: sigue a un toque, sin competir. */
  let arrancarAparte: Accion | null = null;
  if (pantalla === "vacio") {
    principal = puedeVolver
      ? { texto: `Volver a la sala ${ultimaSala}`, icono: <Users />, paso: "volver-sala" }
      : { texto: "Cómo subir una película", paso: "como" };
  } else if (pantalla === "eligiendo") {
    principal = !salaDisponible
      ? { texto: "Ver ahora", icono: <Play />, paso: "ver" }
      : puedeVolver
        ? { texto: `Volver a la sala ${ultimaSala}`, icono: <Users />, paso: "volver-sala" }
        : { texto: "Crear sala", icono: <Users />, paso: "crear" };
  } else if (pantalla === "esperando") {
    if (!portada) principal = { texto: "Elegir película", paso: "elegir" };
    else if (conectada) {
      const arrancar: Accion =
        retomar !== null
          ? { texto: `Retomar en ${reloj(retomar)}`, icono: <Play />, paso: "retomar" }
          : { texto: acompanado ? "Empezar" : "Empezar sin esperar", icono: <Play />, paso: "empezar" };
      // A solas, lo siguiente es que venga la otra persona.
      if (!acompanado && puedeInvitar) {
        principal = { texto: "Invitar", icono: <Share2 />, paso: "invitar" };
        arrancarAparte = arrancar;
      } else principal = arrancar;
    }
  } else if (pantalla === "pausa") {
    principal = { texto: "Seguir", icono: <Play />, paso: "seguir" };
  }

  /**
   * «Invitar»: la hoja de compartir del teléfono con un enlace que entra
   * directo en la sala (`/?sala=8047`). Donde no la hay, el enlace se copia.
   */
  const invitar = async () => {
    const enlace = enlaceDeSala(window.location.origin, codigo);
    const texto = textoDeInvitacion(portada?.titulo, codigo);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "CanalCasa", text: texto, url: enlace });
        return;
      }
      await navigator.clipboard.writeText(`${texto} ${enlace}`);
      setInvitado("Enlace copiado: pégalo en un mensaje.");
    } catch (error) {
      // Cerrar la hoja de compartir sin elegir nada no es un fallo.
      if ((error as { name?: string })?.name === "AbortError") return;
      setInvitado(`No pude compartirlo. Pásale el código ${codigo}.`);
    }
  };

  const empezarSala = juntos.empezar;
  const irASala = juntos.irA;
  const dar = (paso: Paso) => {
    if (paso === "ver" || paso === "seguir") {
      // Dentro del toque, para que el navegador deje sonar el vídeo. En una
      // sala, el play lo recoge `use-ver-juntos` y arrancan todos.
      video?.play().catch(() => {});
    } else if (paso === "crear") conAlias("crear");
    else if (paso === "volver-sala") volverALaSala();
    else if (paso === "elegir") irAlEstante();
    else if (paso === "como") setHoja("como");
    else if (paso === "invitar") void invitar();
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
            : puedeInvitar
              ? `Invita a la otra persona, o díctale el código ${codigo}.`
              : `Pásale el código ${codigo} a la otra persona.`;

  /** En pausa: quién pausó y por dónde van. */
  const lineaPausa =
    pantalla !== "pausa"
      ? ""
      : `${!enSala || !quienPauso ? "En pausa" : quienPauso === "tú" ? "Pausaste" : `${quienPauso} pausó`} · ${enSala ? "van" : "vas"} por ${reloj(tiempoVideo)}`;

  /** Qué hace el PC: mientras se elige o se espera, no con la película en marcha. */
  const lineaPc = pc && pantalla !== "viendo" && pantalla !== "pausa" && (
    <p className="cine-pc" role="status" data-tono={pc.tono}>
      <MonitorUp aria-hidden="true" />
      {pc.texto}
    </p>
  );

  /** Las tarjetas del estante: duración, por dónde iba la sala y si es nueva. */
  const tarjetas = nuestras.peliculas.map((p) => {
    const vista = vistas.find((v) => v.url === p.url);
    const donde = dondeRetomar(vista);
    return {
      url: p.url,
      titulo: p.titulo,
      duracion: duracionCorta(p.duracion) || undefined,
      progreso: vista && donde !== null && vista.duracion > 0 ? Math.min(1, donde / vista.duracion) : undefined,
      iban: donde !== null ? `Iban por ${reloj(donde)}` : undefined,
      nueva: !vista && p.subida !== undefined && ahora > 0 && ahora - p.subida < NUEVA_MS,
    };
  });

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
        inmersivo={escenarioVisible}
        fondo={fondo}
        sobretitulo=""
        titulo={portada?.titulo ?? ""}
        pildoras={pildoras}
        vacia={
          pantalla === "cargando" ? (
            <SalaCargando />
          ) : pantalla === "vacio" ? (
            <SalaVacia pc={lineaPc} />
          ) : !portada ? (
            // Dentro de la sala, con películas y ninguna puesta todavía.
            <h2 id="cine-titulo" className="cine-titulo">
              Elijan una película
            </h2>
          ) : undefined
        }
        estante={
          mostrarEstante && (
            <Estante
              peliculas={tarjetas}
              nota={lineaPc}
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
              // Inmersivo, el mando solo recorre el reproductor: lo de debajo
              // (la barra, la portada) sigue en la página, pero tapado.
              data-nav-ambito={escenarioVisible ? "" : undefined}
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
                    {/* A solas en la sala: el teléfono lo escanea y entra. */}
                    {pantalla === "esperando" && conectada && !acompanado && !escenarioVisible && <QrSala codigo={codigo} />}
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
        {lineaPausa && (
          <p className="cine-pausa" role="status">
            {lineaPausa}
          </p>
        )}
        {principal && (
          <div className="cine-acciones">
            <button
              ref={principalRef}
              type="button"
              data-nav="button"
              data-nav-entrada={dentro || !mostrarEstante ? "" : undefined}
              className="cine-boton-principal"
              onClick={() => dar(principal.paso)}
            >
              {principal.icono}
              {principal.texto}
            </button>
          </div>
        )}
        {(invitado || estadoSala) && pantalla !== "viendo" && pantalla !== "pausa" && (
          <p className="cine-estado" role="status">
            {invitado || estadoSala}
          </p>
        )}
        {/* Con el estante a la vista, la línea del PC va en su cabecera. */}
        {!mostrarEstante && pantalla !== "vacio" && lineaPc}
        {/* Todo lo demás, en texto y en una sola fila: nada compite con el botón
            principal. Ver una película a solas no tiene botón propio: es el
            play del reproductor. */}
        <div className="cine-secundarias">
          {arrancarAparte && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={() => dar(arrancarAparte.paso)}>
              {arrancarAparte.texto}
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
          {pantalla === "viendo" && !inmersivo && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={pantallaCompleta}>
              Pantalla completa
            </button>
          )}
          {salaDisponible && !dentro && puedeVolver && pantalla !== "viendo" && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={() => conAlias("crear")}>
              Crear sala
            </button>
          )}
          {salaDisponible && !dentro && pantalla !== "viendo" && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={() => conAlias("entrar")}>
              Entrar con código
            </button>
          )}
          {portada && nuestras.peliculas.length > 1 && !mostrarEstante && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={irAlEstante}>
              Cambiar película
            </button>
          )}
          {pantalla === "vacio" && puedeVolver && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={() => setHoja("como")}>
              Cómo subir una película
            </button>
          )}
          {enSala && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={() => { ponerCodigo(""); setInmersivo(false); setInvitado(""); }}>
              Salir de la sala
            </button>
          )}
          {/* Dentro de la sala solo si no hay otra película que poner. */}
          {pantalla !== "viendo" && (!dentro || nuestras.peliculas.length <= 1) && (
            <button type="button" data-nav="button" className="cine-boton-texto" onClick={() => setHoja("enlace")}>
              Usar un enlace
            </button>
          )}
          {/* El nombre se cambia fuera de la sala: dentro ya se ve en la presencia. */}
          {salaDisponible && perfil && !dentro && pantalla !== "viendo" && (
            <button
              type="button"
              data-nav="button"
              className="cine-boton-texto"
              aria-label={`Tu nombre: ${perfil.nombre}. Cambiarlo`}
              onClick={() => setHoja("alias")}
            >
              <span className="cine-mini-avatar" aria-hidden="true">
                {iniciales(perfil.nombre)}
              </span>
              {perfil.nombre}
            </button>
          )}
        </div>
      </Portada>

      {nuestras.configurado && nuestras.listo && nuestras.fallo && (
        <Aviso tono="aviso" className="fuente-aviso">
          No se pudo leer la lista de películas. Si acabas de crear el bucket, revisa su CORS (ver
          docs/PELICULAS-JUNTOS.md).
        </Aviso>
      )}

      {vistas.length > 0 && pantalla !== "viendo" && (
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

      <Hoja abierta={hoja === "como"} titulo="Cómo subir una película" alCerrar={() => setHoja(null)}>
        <ol className="cine-pasos">
          <li>En tu PC, abre «CanalCasa Peliculas» (el panel)</li>
          <li>Pulsa «+ Agregar película» o «Descargar desde un enlace»</li>
          <li>Pulsa «Subir cambios», o deja que «Sincronizar sola» lo haga cada 10 minutos</li>
          <li>Cuando termine de convertir y subir, aparece aquí en todos los aparatos</li>
        </ol>
        {pc && (
          <p className="cine-pc mt-4" role="status" data-tono={pc.tono}>
            <MonitorUp aria-hidden="true" />
            {pc.texto}
          </p>
        )}
      </Hoja>

      <Hoja abierta={hoja === "alias"} titulo={salaPorEnlace ? "Te invitaron a ver una película" : "¿Cómo te llamas?"} alCerrar={() => setHoja(null)}>
        {salaPorEnlace && <p className="cine-bienvenida-paso">Paso 1 de 3 · Dinos cómo te llamas: es lo que verá la otra persona.</p>}
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
            else if (salaPorEnlace) {
              // Venía por un enlace de invitación: ya con nombre, entra.
              soloSiVaciaRef.current = true;
              ponerCodigo(salaPorEnlace);
              setSalaPorEnlace("");
              // Primera vez: dos pantallas cortas sobre qué es esto.
              setPasoBienvenida(2);
              setHoja("bienvenida");
            }
          }}
        />
      </Hoja>

      <Hoja abierta={hoja === "bienvenida"} titulo={pasoBienvenida === 2 ? "Ya estás dentro" : "Todos mandan"} alCerrar={() => setHoja(null)}>
        <div className="cine-bienvenida">
          <p className="cine-bienvenida-paso">Paso {pasoBienvenida} de 3</p>
          {pasoBienvenida === 2 ? (
            <>
              <p className="cine-vacio-frase">
                Estás en la sala {codigo}. La película llega sola: no tienes que buscarla. Cuando alguien pulse «Empezar», arranca
                a la vez en todos los aparatos.
              </p>
              <button type="button" data-nav="button" className="cine-boton-principal" onClick={() => setPasoBienvenida(3)}>
                Siguiente
              </button>
            </>
          ) : (
            <>
              <p className="cine-vacio-frase">
                Cualquiera puede pausar, seguir o adelantar, y pasa en todos. Si sales de la app un momento, al volver sigues en la
                sala.
              </p>
              <button type="button" data-nav="button" className="cine-boton-principal" onClick={() => setHoja(null)}>
                Entendido
              </button>
            </>
          )}
        </div>
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
