"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { publicConfig } from "@/lib/config";
import { canalDeSala, leerMensaje, type MensajeSala, type VideoDeSala } from "@/lib/ver-juntos/sala";

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
 * Lo que tarda el `<video>` en contar lo que le acabamos de hacer. Mientras,
 * sus eventos son eco y no se reenvían. Holgado por los televisores: un salto
 * en HLS puede tardar en asentarse.
 */
const VENTANA_ECO_MS = 1000;
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
  disconnect(): void;
  connection: { bind(evento: string, fn: () => void): void };
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

  const canalRef = useRef<CanalPusher | null>(null);
  const suscritoRef = useRef(false);
  const elementoRef = useRef<HTMLVideoElement | null>(null);
  const silencioHastaRef = useRef(0);
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

  /** Lleva el `<video>` local al estado que manda el otro. */
  const aplicar = useCallback((tiempo: number, pausado: boolean) => {
    const v = elementoRef.current;
    if (!v) return;
    sincronizadoRef.current = true;

    const saltar = Math.abs(v.currentTime - tiempo) > TOLERANCIA_S;
    const pausar = pausado && !v.paused;
    const arrancar = !pausado && v.paused;
    // La ventana de eco se abre solo si de verdad se toca el vídeo. Abrirla en
    // cada pulso —aunque no cambiara nada— se tragaba la pausa que la persona
    // hiciera justo después, tomándola por eco: el otro no se enteraba y el
    // siguiente pulso volvía a arrancarle el vídeo.
    if (!saltar && !pausar && !arrancar) return;
    silencioHastaRef.current = Date.now() + VENTANA_ECO_MS;

    if (saltar) v.currentTime = tiempo;
    if (pausar) v.pause();
    if (arrancar) {
      v.play().catch(() => {
        // Sin un gesto en este aparato, el navegador no deja sonar un vídeo.
        necesitaToqueRef.current = true;
        setNecesitaToque(true);
      });
    }
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
          if (!anfitrionRef.current) enviar({ tipo: "hola" });
        });
        canal.bind("pusher:subscription_error", () => {
          if (!cancelado) setConexion({ codigo, estado: "error" });
        });
        canal.bind(EVENTO, recibir);
        cliente.connection.bind("error", () => {
          if (!cancelado) setConexion({ codigo, estado: "error" });
        });
      } catch (error) {
        console.error("❌ Ver juntos: no se pudo conectar", error);
        if (!cancelado) setConexion({ codigo, estado: "error" });
      }
    })();

    return () => {
      cancelado = true;
      suscritoRef.current = false;
      canalRef.current = null;
      setAcompanado(false);
      try {
        cliente?.unsubscribe(nombreCanal);
        cliente?.disconnect();
      } catch {
        // Cerrar una conexión ya cerrada no es un problema.
      }
    };
  }, [codigo, configurada, enviar, estadoActual, aplicar]);

  // --- Lo que hace el vídeo local, se cuenta --------------------------------
  useEffect(() => {
    if (!elemento || !codigo) return;
    const contar = () => {
      // Lo que acabamos de aplicar desde fuera es eco: no se devuelve.
      if (Date.now() < silencioHastaRef.current) return;

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
    elemento.addEventListener("play", contar);
    elemento.addEventListener("pause", contar);
    elemento.addEventListener("seeked", contar);
    return () => {
      elemento.removeEventListener("play", contar);
      elemento.removeEventListener("pause", contar);
      elemento.removeEventListener("seeked", contar);
    };
  }, [elemento, codigo, enviar, estadoActual]);

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
    /** Para `NativePlayer`: le dice a la sala cuál es el `<video>`. */
    alVideo: setElemento,
  };
}
