"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { publicConfig } from "@/lib/config";
import { canalDeSala, leerMensaje, type MensajeSala, type VideoDeSala } from "@/lib/ver-juntos/sala";
import { esEco, type Esperado } from "@/lib/ver-juntos/eco";

/**
 * «Ver juntos»: dos aparatos con el mismo vídeo, al mismo segundo.
 *
 * Recuperado del Watch Party que se retiró en agosto (commit d52ed89). Lo que
 * se conserva: Pusher con *client events* sobre canal privado —los mensajes
 * van de aparato a aparato sin pasar por nuestro servidor—, `pusher-js`
 * cargado solo al entrar en una sala, la tolerancia antes de corregir y la
 * supresión de eco. Lo que cambia, y por qué:
 *
 * - **Escucha al `<video>`, no a los botones.** Antes cada botón tenía que
 *   acordarse de avisar, y pausar con el mando de la tele, con la barra
 *   espaciadora o con los auriculares no avisaba a nadie. Ahora cuenta lo que
 *   hace el vídeo, venga de donde venga.
 * - **Un anfitrión.** Quien crea la sala manda: su pulso cada cinco segundos
 *   corrige al invitado, nunca al revés. Si los dos se corrigieran entre sí con
 *   un desfase, cada uno saltaría al tiempo viejo del otro y se perseguirían.
 * - **El invitado no tiene que tener el enlace.** Escribe el código y el
 *   anfitrión le manda el vídeo.
 * - **Sin compensar con relojes.** Se compensaba con `Date.now()` del otro
 *   aparato, y el reloj de una tele puede ir minutos desviado.
 * - **El invitado no manda nada hasta haberse sincronizado una vez.** Si no,
 *   su primer play —en el segundo 0, o donde lo dejó la última vez— mandaba
 *   al anfitrión al principio de la película.
 */

/** Por debajo de esto no se corrige: cada salto pequeño es un tirón visible. */
const TOLERANCIA_S = 1.5;
/**
 * Tras volver de segundo plano más de esto, la conexión se rehace a la fuerza.
 * Safari en iPhone congela la página al cambiar de app (p. ej. a WhatsApp para
 * mandar el código) y el socket muere sin avisar: `pusher-js` no lo nota hasta
 * su propio ping, hasta dos minutos y medio después, y mientras tanto lo que se
 * manda se pierde en silencio.
 */
const REHACER_TRAS_MS = 5000;
/** Cada cuánto manda cada uno su estado. Es el pulso y, de paso, la presencia. */
const PULSO_MS = 5000;
/** Sin noticias del otro en este tiempo, se da por ido. */
const AUSENCIA_MS = 3 * PULSO_MS;

const EVENTO = "client-mensaje";

export type EstadoSala = "inactiva" | "sin-configurar" | "conectando" | "conectada" | "error";

interface CanalPusher {
  bind(evento: string, fn: (dato: unknown) => void): void;
  trigger(evento: string, dato: MensajeSala): boolean;
}
interface ClientePusher {
  subscribe(canal: string): CanalPusher;
  unsubscribe(canal: string): void;
  connect(): void;
  disconnect(): void;
  connection: {
    bind(evento: string, fn: (cambio?: { current?: string }) => void): void;
  };
}

export interface OpcionesSala {
  /** Código de la sala; vacío = sin sala. Ver `normalizarCodigo`. */
  codigo: string;
  /** Quien creó la sala. Su reproductor manda. */
  anfitrion: boolean;
  /** Lo que está sonando. Solo lo usa el anfitrión, para mandárselo a quien entre. */
  video: VideoDeSala | null;
  /** El invitado recibe aquí el vídeo del anfitrión. */
  alRecibirVideo?: (video: VideoDeSala) => void;
}

export function useVerJuntos({ codigo, anfitrion, video, alRecibirVideo }: OpcionesSala) {
  const configurada = Boolean(publicConfig.pusherKey);

  /** Lo escriben solo las devoluciones de Pusher; el estado visible se deriva. */
  const [conexion, setConexion] = useState<{ codigo: string; estado: "conectada" | "error" } | null>(
    null,
  );
  const [elemento, setElemento] = useState<HTMLVideoElement | null>(null);
  const [acompanado, setAcompanado] = useState(false);
  /** El navegador no dejó arrancar el vídeo sin un toque de la persona. */
  const [necesitaToque, setNecesitaToque] = useState(false);
  /**
   * Arrancó, pero sin sonido: el navegador solo dejaba eso sin un toque
   * (iPhone). Mejor ir sincronizado y mudo que parado: un toque lo arregla.
   */
  const [silenciadoPorSala, setSilenciadoPorSala] = useState(false);

  const canalRef = useRef<CanalPusher | null>(null);
  const suscritoRef = useRef(false);
  const elementoRef = useRef<HTMLVideoElement | null>(null);
  /** Lo último que la sala le pidió al vídeo local: sus eventos son eco. */
  const esperadoRef = useRef<Esperado | null>(null);
  /** Un estado que llegó antes de que el vídeo supiera su duración. */
  const pendienteRef = useRef<{ tiempo: number; pausado: boolean } | null>(null);
  const sincronizadoRef = useRef(false);
  const ultimoContactoRef = useRef(0);
  const necesitaToqueRef = useRef(false);
  /** Lo último de cada prop, para que el canal no tenga que resuscribirse. */
  const anfitrionRef = useRef(anfitrion);
  const videoRef = useRef(video);
  const alRecibirVideoRef = useRef(alRecibirVideo);

  useEffect(() => {
    anfitrionRef.current = anfitrion;
    videoRef.current = video;
    alRecibirVideoRef.current = alRecibirVideo;
    elementoRef.current = elemento;
  });

  const estado: EstadoSala = !codigo
    ? "inactiva"
    : !configurada
      ? "sin-configurar"
      : conexion?.codigo === codigo
        ? conexion.estado
        : "conectando";

  const enviar = useCallback((mensaje: MensajeSala) => {
    const canal = canalRef.current;
    if (!canal || !suscritoRef.current) return;
    try {
      canal.trigger(EVENTO, mensaje);
    } catch (error) {
      // Falla si «Enable client events» está apagado en el panel de Pusher.
      // No debe romper la reproducción de nadie.
      console.warn("Ver juntos: no se pudo enviar", error);
    }
  }, []);

  const estadoActual = useCallback((pulso = false): MensajeSala | null => {
    const v = elementoRef.current;
    if (!v) return null;
    return { tipo: "estado", tiempo: v.currentTime, pausado: v.paused, pulso };
  }, []);

  /**
   * `play()` pedido por la sala, sin gesto de la persona en este aparato.
   *
   * Los navegadores móviles no dejan sonar un vídeo así. Primero se insiste
   * en silencio —eso sí lo permiten, con `playsinline`— y se avisa con «Toca
   * para activar el sonido»; solo si ni así, se pide el toque para unirse.
   */
  const arrancar = useCallback((v: HTMLVideoElement, tiempo: number) => {
    v.play().catch((error: unknown) => {
      if ((error as { name?: string })?.name !== "NotAllowedError") return;
      if (v.muted) {
        necesitaToqueRef.current = true;
        setNecesitaToque(true);
        return;
      }
      v.muted = true;
      esperadoRef.current = { tiempo, pausado: false, desde: Date.now() };
      v.play()
        .then(() => setSilenciadoPorSala(true))
        .catch(() => {
          // Ni en silencio (modo de bajo consumo del iPhone, por ejemplo).
          v.muted = false;
          necesitaToqueRef.current = true;
          setNecesitaToque(true);
        });
    });
  }, []);

  /** Lleva el `<video>` local al estado que manda el otro. */
  const aplicar = useCallback((tiempo: number, pausado: boolean) => {
    const v = elementoRef.current;
    if (!v) return;

    /*
     * Sin metadatos todavía, un salto se pierde: Safari (y por tanto el
     * iPhone, que lleva el HLS en nativo) descarta `currentTime` mientras
     * `readyState` es 0, en vez de guardarlo para cuando cargue como hace
     * Chrome. Se aparca y se aplica en `loadedmetadata` (ver más abajo). Si hay que
     * reproducir, se intenta ya: en iPhone es lo que hace que empiece a
     * cargar. Hasta entonces no cuenta como sincronizado: su `play` sería
     * el del segundo 0 y mandaría al anfitrión al principio.
     */
    if (v.readyState < 1) {
      pendienteRef.current = { tiempo, pausado };
      if (!pausado && v.paused) arrancar(v, tiempo);
      return;
    }
    pendienteRef.current = null;
    sincronizadoRef.current = true;

    const saltar = Math.abs(v.currentTime - tiempo) > TOLERANCIA_S;
    const pausar = pausado && !v.paused;
    const reproducir = !pausado && v.paused;
    // Solo si de verdad se toca el vídeo se espera eco. Esperarlo en cada
    // pulso —aunque no cambiara nada— se tragaba la pausa que la persona
    // hiciera justo después: el otro no se enteraba y el siguiente pulso
    // volvía a arrancarle el vídeo.
    if (!saltar && !pausar && !reproducir) return;
    esperadoRef.current = { tiempo: saltar ? tiempo : v.currentTime, pausado, desde: Date.now() };

    if (saltar) v.currentTime = tiempo;
    if (pausar) v.pause();
    if (reproducir) arrancar(v, tiempo);
  }, [arrancar]);

  /** El toque que pide `necesitaToque`: dentro del gesto, el navegador deja. */
  const unirse = useCallback(() => {
    const v = elementoRef.current;
    if (!v) return;
    v.muted = false;
    // El evento `play` que sigue lo recoge `contar`: pide el estado de nuevo.
    v.play().catch(() => {});
  }, []);

  const activarSonido = useCallback(() => {
    const v = elementoRef.current;
    if (v) v.muted = false;
    setSilenciadoPorSala(false);
  }, []);

  // --- La conexión ----------------------------------------------------------
  useEffect(() => {
    if (!codigo || !configurada) return;
    let cancelado = false;
    let cliente: ClientePusher | null = null;
    const nombreCanal = canalDeSala(codigo);
    sincronizadoRef.current = false;
    ultimoContactoRef.current = 0;

    const recibir = (dato: unknown) => {
      const mensaje = leerMensaje(dato);
      if (!mensaje || cancelado) return;
      ultimoContactoRef.current = Date.now();
      setAcompanado(true);

      if (mensaje.tipo === "hola") {
        if (!anfitrionRef.current) return;
        if (videoRef.current) enviar({ tipo: "video", video: videoRef.current });
        const actual = estadoActual();
        if (actual) enviar(actual);
        return;
      }
      if (mensaje.tipo === "video") {
        if (!anfitrionRef.current) alRecibirVideoRef.current?.(mensaje.video);
        return;
      }
      // Estado. El pulso solo lo sigue el invitado; el del invitado al
      // anfitrión le sirve únicamente para saber que sigue ahí.
      if (mensaje.pulso && anfitrionRef.current) return;
      aplicar(mensaje.tiempo, mensaje.pausado);
    };

    (async () => {
      try {
        // Carga diferida: solo quien entra en una sala paga estos KB.
        const { default: Pusher } = await import("pusher-js");
        if (cancelado) return;
        cliente = new Pusher(publicConfig.pusherKey, {
          cluster: publicConfig.pusherCluster,
          channelAuthorization: { endpoint: "/api/pusher/auth", transport: "ajax" },
        }) as unknown as ClientePusher;

        const canal = cliente.subscribe(nombreCanal);
        canalRef.current = canal;
        canal.bind("pusher:subscription_succeeded", () => {
          if (cancelado) return;
          suscritoRef.current = true;
          setConexion({ codigo, estado: "conectada" });
          // Quien llega pide el estado; si el anfitrión ya está, contesta.
          // Esto corre también al reconectar: el anfitrión, entonces, cuenta
          // dónde va sin esperar al pulso.
          if (!anfitrionRef.current) enviar({ tipo: "hola" });
          else {
            const actual = estadoActual();
            if (actual) enviar(actual);
          }
        });
        canal.bind("pusher:subscription_error", () => {
          if (!cancelado) setConexion({ codigo, estado: "error" });
        });
        canal.bind(EVENTO, recibir);
        cliente.connection.bind("error", () => {
          if (!cancelado) setConexion({ codigo, estado: "error" });
        });
        // Sin conexión no hay suscripción: lo que se mande ahí se pierde, y
        // al volver `subscription_succeeded` lo pone otra vez en marcha.
        cliente.connection.bind("state_change", (cambio) => {
          if (cambio?.current !== "connected") suscritoRef.current = false;
        });
      } catch (error) {
        console.error("❌ Ver juntos: no se pudo conectar", error);
        if (!cancelado) setConexion({ codigo, estado: "error" });
      }
    })();

    let ocultaDesde = 0;
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "hidden") {
        ocultaDesde = Date.now();
        return;
      }
      if (!ocultaDesde || Date.now() - ocultaDesde < REHACER_TRAS_MS || !cliente) return;
      ocultaDesde = 0;
      suscritoRef.current = false;
      // `pusher-js` vuelve a suscribir sus canales solo al reconectar.
      cliente.disconnect();
      cliente.connect();
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    return () => {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      /**
       * Quien se va, pausa a los dos.
       *
       * Esto corre también al salir de Mi enlace sin salir de la sala —pulsar
       * Atrás en el mando—, porque la vista se oculta y sus efectos se
       * limpian. El `<video>` local ya se pausa solo al ocultarse (ver
       * `NativePlayer`), pero esa pausa llega cuando el canal ya se cerró: el
       * otro seguía viendo la película solo, y al volver iban desfasados.
       * Al regresar, la sala se reconecta sola y el estado vuelve a cuadrar.
       */
      const v = elementoRef.current;
      let despedida = false;
      if (suscritoRef.current && v && (anfitrionRef.current || sincronizadoRef.current)) {
        enviar({ tipo: "estado", tiempo: v.currentTime, pausado: true });
        despedida = true;
      }
      cancelado = true;
      suscritoRef.current = false;
      canalRef.current = null;
      setAcompanado(false);
      const colgar = () => {
        try {
          cliente?.unsubscribe(nombreCanal);
          cliente?.disconnect();
        } catch {
          // Cerrar una conexión ya cerrada no es un problema.
        }
      };
      // Colgar en el mismo instante perdía la despedida (medido: el mensaje
      // no llegaba al otro). Medio segundo le da tiempo a salir.
      if (despedida) window.setTimeout(colgar, 500);
      else colgar();
    };
  }, [codigo, configurada, enviar, estadoActual, aplicar]);

  // --- Lo que hace el vídeo local, se cuenta --------------------------------
  useEffect(() => {
    if (!elemento || !codigo) return;
    const contar = (evento: Event) => {
      // Lo que acabamos de aplicar desde fuera es eco: no se devuelve.
      const ahora = { tiempo: elemento.currentTime, pausado: elemento.paused };
      if (esEco(esperadoRef.current, ahora, Date.now(), TOLERANCIA_S, evento.type as "play" | "pause" | "seeked")) {
        return;
      }

      if (pendienteRef.current) return;
      if (!anfitrionRef.current && !sincronizadoRef.current) return;
      if (necesitaToqueRef.current) {
        // El primer play tras el bloqueo del navegador no es una orden: es la
        // persona aceptando. Se pide el estado de nuevo en vez de imponer el
        // tiempo de este aparato, que se quedó parado.
        necesitaToqueRef.current = false;
        setNecesitaToque(false);
        enviar({ tipo: "hola" });
        return;
      }
      const actual = estadoActual();
      if (actual) enviar(actual);
    };
    // Si la persona quita el silencio con el botón del reproductor, el aviso
    // de «Toca para activar el sonido» sobra.
    const alVolumen = () => {
      if (!elemento.muted) setSilenciadoPorSala(false);
    };
    // Lo aparcado por llegar antes que los metadatos (ver `aplicar`).
    const alMetadatos = () => {
      const pendiente = pendienteRef.current;
      if (pendiente) aplicar(pendiente.tiempo, pendiente.pausado);
    };
    elemento.addEventListener("loadedmetadata", alMetadatos);
    elemento.addEventListener("volumechange", alVolumen);
    elemento.addEventListener("play", contar);
    elemento.addEventListener("pause", contar);
    elemento.addEventListener("seeked", contar);
    return () => {
      elemento.removeEventListener("loadedmetadata", alMetadatos);
      elemento.removeEventListener("volumechange", alVolumen);
      elemento.removeEventListener("play", contar);
      elemento.removeEventListener("pause", contar);
      elemento.removeEventListener("seeked", contar);
    };
  }, [elemento, codigo, enviar, estadoActual, aplicar]);

  // --- El anfitrión cambia de vídeo: se lo dice al invitado ------------------
  const urlVideo = video?.url ?? "";
  useEffect(() => {
    if (estado !== "conectada" || !anfitrion || !videoRef.current) return;
    enviar({ tipo: "video", video: videoRef.current });
  }, [estado, anfitrion, urlVideo, enviar]);

  // --- Pulso y presencia ----------------------------------------------------
  useEffect(() => {
    if (estado !== "conectada") return;
    const id = window.setInterval(() => {
      const actual = estadoActual(true);
      // El invitado sin vídeo todavía insiste con `hola`: si el anfitrión
      // entró después, así se encuentran.
      if (actual) enviar(actual);
      else if (!anfitrionRef.current) enviar({ tipo: "hola" });

      if (ultimoContactoRef.current && Date.now() - ultimoContactoRef.current > AUSENCIA_MS) {
        setAcompanado(false);
      }
    }, PULSO_MS);
    return () => window.clearInterval(id);
  }, [estado, enviar, estadoActual]);

  return {
    estado,
    /** Hay alguien más en la sala (se ha oído de él hace poco). */
    acompanado: estado === "conectada" && acompanado,
    necesitaToque,
    silenciadoPorSala,
    unirse,
    activarSonido,
    /** Para `NativePlayer`: le dice a la sala cuál es el `<video>`. */
    alVideo: setElemento,
  };
}
