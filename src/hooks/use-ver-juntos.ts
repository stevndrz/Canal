"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { publicConfig } from "@/lib/config";
import {
  canalDeSala,
  leerMensaje,
  esMasNueva,
  quienDirige,
  type MensajeSala,
  type PeliculaDeSala,
  type VideoDeSala,
} from "@/lib/ver-juntos/sala";
import { esEco, type Esperado } from "@/lib/ver-juntos/eco";
import { leerSalaRecordada, recordarSala, type Perfil } from "@/lib/ver-juntos/recordar";

/**
 * «Ver juntos»: una sala con código de cuatro cifras, y cada uno con su alias.
 *
 * Pusher con *client events* sobre un canal de **presencia**: los mensajes van
 * de aparato a aparato sin pasar por nuestro servidor, y Pusher dice quién
 * está, con el alias que eligió cada uno. Lo que se conserva
 * de la versión de las salas con código:
 *
 * - **Escucha al `<video>`, no a los botones**: pausar con el mando, con la
 *   barra espaciadora o con los auriculares también cuenta.
 * - **Uno dirige**: su pulso cada cinco segundos corrige a los demás, nunca al
 *   revés. Ya no es «quien creó la sala» (no hay que crearla): es quien eligió
 *   la película, o quien llevaba más tiempo dentro. Ver `quienDirige`.
 * - **Sin compensar con relojes**: el de una tele puede ir minutos desviado.
 * - **Quien llega no manda nada hasta haberse sincronizado una vez**: su
 *   primer play, en el segundo 0, mandaría a todos al principio.
 *
 * Lo nuevo: **la última película elegida manda** (`masNueva`), sea quien sea
 * quien la eligió; y la **cuenta atrás**: «Empezar» la lanza en todos a la vez
 * y al acabar arranca.
 */

/** Por debajo de esto no se corrige: cada salto pequeño es un tirón visible. */
const TOLERANCIA_S = 1.5;
/**
 * Tras volver de segundo plano más de esto, la conexión se rehace a la fuerza.
 * Safari en iPhone congela la página al cambiar de app y el socket muere sin
 * avisar: `pusher-js` no lo nota hasta su propio ping, hasta dos minutos y
 * medio después, y mientras tanto lo que se manda se pierde en silencio.
 */
const REHACER_TRAS_MS = 5000;
/** Cada cuánto cuenta quien dirige por dónde va. */
const PULSO_MS = 5000;
/** Segundos de la cuenta atrás de «Empezar». */
export const CUENTA_S = 3;
/** Lo que dura en pantalla «Steven pausó». */
const AVISO_MS = 2500;

const EVENTO = "client-mensaje";

export type EstadoSala = "fuera" | "sin-configurar" | "conectando" | "conectada" | "error";

export interface Miembro {
  id: string;
  nombre: string;
}

/** Lo que pasó en otro aparato y merece un aviso breve en este. */
export interface AvisoSala {
  nombre: string;
  que: "pausó" | "reanudó" | "saltó";
  /** Para que dos avisos iguales seguidos se vean como dos. */
  n: number;
}

interface MiembroPusher {
  id: string;
  info?: { nombre?: unknown };
}
interface MiembrosPusher {
  each(fn: (miembro: MiembroPusher) => void): void;
  me?: MiembroPusher | null;
}
interface CanalPusher {
  bind(evento: string, fn: (dato: unknown, metadatos?: { user_id?: string }) => void): void;
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
  /** El alias y el id de este aparato; sin perfil no se entra. */
  perfil: Perfil | null;
  /** El código de la sala; vacío = fuera, no se conecta nada. */
  codigo: string;
}

function nombreDe(miembro: MiembroPusher): string {
  const nombre = miembro.info?.nombre;
  return typeof nombre === "string" && nombre ? nombre : "Alguien";
}

export function useVerJuntos({ perfil, codigo }: OpcionesSala) {
  const configurada = Boolean(publicConfig.pusherKey);
  const yo = perfil?.id ?? "";
  const canalSala = perfil && codigo ? canalDeSala(codigo) : "";

  /** Lo escriben solo las devoluciones de Pusher; el estado visible se deriva. */
  const [conexion, setConexion] = useState<{ canal: string; estado: "conectada" | "error" } | null>(null);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [pelicula, setPelicula] = useState<PeliculaDeSala | null>(null);
  const [elemento, setElemento] = useState<HTMLVideoElement | null>(null);
  /** El navegador no dejó arrancar el vídeo sin un toque de la persona. */
  const [necesitaToque, setNecesitaToque] = useState(false);
  /**
   * Arrancó, pero sin sonido: el navegador solo dejaba eso sin un toque
   * (iPhone). Mejor ir sincronizado y mudo que parado: un toque lo arregla.
   */
  const [silenciadoPorSala, setSilenciadoPorSala] = useState(false);
  /** 3, 2, 1… o `null` sin cuenta atrás. */
  const [cuenta, setCuenta] = useState<number | null>(null);
  const [aviso, setAviso] = useState<AvisoSala | null>(null);

  const canalRef = useRef<CanalPusher | null>(null);
  const suscritoRef = useRef(false);
  const elementoRef = useRef<HTMLVideoElement | null>(null);
  /** Lo último que la sala le pidió al vídeo local: sus eventos son eco. */
  const esperadoRef = useRef<Esperado | null>(null);
  /** Un estado que llegó antes de que el vídeo supiera su duración. */
  const pendienteRef = useRef<{ tiempo: number; pausado: boolean } | null>(null);
  const sincronizadoRef = useRef(false);
  const necesitaToqueRef = useRef(false);
  /** El play-y-pausa de «Empezar» que desbloquea el sonido: no es de nadie. */
  const desbloqueandoRef = useRef(false);
  /** Al acabar la cuenta atrás no había vídeo todavía: arranca en cuanto llegue. */
  const arrancarAlLlegarRef = useRef(false);
  /** Orden de llegada que ve este aparato, `yo` incluido. */
  const ordenRef = useRef<string[]>([]);
  const peliculaRef = useRef(pelicula);
  const miembrosRef = useRef(miembros);
  const codigoRef = useRef(codigo);
  const avisosRef = useRef(0);

  useEffect(() => {
    // Cada sala tiene su película. Al volver a la misma (Atrás y otra vez a
    // Mi enlace), la que tenía; en una sala nueva, ninguna hasta que alguien
    // elija. Tras montar: en el servidor no hay `sessionStorage`.
    const recordada = leerSalaRecordada();
    const suya = codigo && recordada?.codigo === codigo ? recordada.pelicula : null;
    peliculaRef.current = suya;
    sincronizadoRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPelicula(suya);
  }, [codigo]);

  useEffect(() => {
    peliculaRef.current = pelicula;
    miembrosRef.current = miembros;
    codigoRef.current = codigo;
    elementoRef.current = elemento;
  });

  const estado: EstadoSala = !canalSala
    ? "fuera"
    : !configurada
      ? "sin-configurar"
      : conexion?.canal === canalSala
        ? conexion.estado
        : "conectando";

  const dirige = quienDirige(pelicula, miembros.map((m) => m.id)) ?? yo;
  const dirijo = dirige === yo;
  const dirijoRef = useRef(dirijo);
  useEffect(() => {
    dirijoRef.current = dirijo;
  });

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

  /** Adopta la película si es más nueva que la que había. */
  const adoptar = useCallback((recibida: PeliculaDeSala) => {
    if (!esMasNueva(recibida, peliculaRef.current)) return;
    peliculaRef.current = recibida;
    // Película nueva: hasta que quien dirige cuente por dónde va, este
    // aparato no manda nada.
    sincronizadoRef.current = false;
    setPelicula(recibida);
    recordarSala({ codigo: codigoRef.current, pelicula: recibida });
  }, []);

  /**
   * `play()` pedido por la sala, sin gesto de la persona en este aparato.
   *
   * Los navegadores móviles no dejan sonar un vídeo así. Primero se insiste
   * en silencio —eso sí lo permiten, con `playsinline`— y se avisa con «Toca
   * para activar el sonido»; solo si ni así, se pide el toque para unirse.
   */
  const arrancar = useCallback((v: HTMLVideoElement, tiempo: number) => {
    esperadoRef.current = { tiempo, pausado: false, desde: Date.now() };
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

  /** Lleva el `<video>` local al estado que manda otro aparato. */
  const aplicar = useCallback(
    (tiempo: number, pausado: boolean) => {
      const v = elementoRef.current;
      if (!v) return;

      /*
       * Sin metadatos todavía, un salto se pierde: Safari (y por tanto el
       * iPhone, que lleva el HLS en nativo) descarta `currentTime` mientras
       * `readyState` es 0, en vez de guardarlo para cuando cargue como hace
       * Chrome. Se aparca y se aplica en `loadedmetadata` (ver más abajo). Si
       * hay que reproducir, se intenta ya: en iPhone es lo que hace que empiece
       * a cargar. Hasta entonces no cuenta como sincronizado: su `play` sería
       * el del segundo 0 y mandaría a todos al principio.
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
    },
    [arrancar],
  );

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

  /** Quien eligió dirige: cuenta por dónde va para que los demás le sigan. */
  const elegir = useCallback(
    (video: VideoDeSala) => {
      if (!yo) return;
      const actual = peliculaRef.current;
      if (actual && actual.video.url === video.url && actual.por === yo) return;
      const nueva: PeliculaDeSala = { video, version: (actual?.version ?? 0) + 1, por: yo };
      peliculaRef.current = nueva;
      sincronizadoRef.current = true;
      setPelicula(nueva);
      recordarSala({ codigo: codigoRef.current, pelicula: nueva });
      enviar({ tipo: "video", pelicula: nueva });
    },
    [yo, enviar],
  );

  /**
   * «Retomar en 47:10»: lleva a TODA la sala a ese segundo, en pausa.
   *
   * Lo puede pulsar cualquiera, dirija o no, y aunque acabe de llegar: es una
   * orden explícita de la persona, no el play accidental del segundo 0 del
   * que protege `sincronizadoRef`. Pasa por `aplicar` para que en Safari el
   * salto no se pierda si el vídeo aún no cargó.
   */
  const irA = useCallback(
    (tiempo: number) => {
      sincronizadoRef.current = true;
      aplicar(tiempo, true);
      enviar({ tipo: "estado", tiempo, pausado: true });
    },
    [aplicar, enviar],
  );

  // --- Cuenta atrás ------------------------------------------------------------
  const lanzarCuenta = useCallback(() => setCuenta(CUENTA_S), []);

  useEffect(() => {
    if (cuenta === null) return;
    const id = window.setTimeout(() => {
      if (cuenta > 1) {
        setCuenta(cuenta - 1);
        return;
      }
      setCuenta(null);
      // Arrancan todos a la vez y desde donde estén: el pulso de quien dirige
      // iguala lo que quede de diferencia.
      // Quien arranca con la cuenta atrás ya va con la sala: su pausa o su
      // salto de los primeros segundos cuentan, sin esperar al primer pulso.
      sincronizadoRef.current = true;
      const v = elementoRef.current;
      if (v) arrancar(v, v.currentTime);
      else arrancarAlLlegarRef.current = true;
    }, 1000);
    return () => window.clearTimeout(id);
  }, [cuenta, arrancar]);

  /**
   * «Empezar»: la cuenta atrás, aquí y en los demás.
   *
   * Dentro del toque se da un play y una pausa al vídeo, si ya está: Safari
   * solo deja reproducir con sonido desde un gesto, y al acabar la cuenta ya
   * no lo es. Tras ese primer play, el vídeo queda desbloqueado.
   */
  const empezar = useCallback(() => {
    const v = elementoRef.current;
    if (v && v.paused) {
      /*
       * Ese play no se le cuenta a la sala. Antes sí: salía como un «estado»
       * en marcha y el otro aparato arrancaba YA, durante la cuenta atrás,
       * tres segundos por delante hasta que un pulso lo corregía (y si quien
       * pulsaba no dirigía, era quien dirige el que iba adelantado). La pausa
       * de después sí se reconocía como eco; el play, no.
       */
      desbloqueandoRef.current = true;
      esperadoRef.current = { tiempo: v.currentTime, pausado: true, desde: Date.now() };
      v.play()
        .then(() => v.pause())
        .catch(() => {})
        // Sus eventos llegan un instante después; la cuenta atrás dura segundos.
        .finally(() => window.setTimeout(() => (desbloqueandoRef.current = false), 400));
    }
    enviar({ tipo: "empezar" });
    lanzarCuenta();
  }, [enviar, lanzarCuenta]);

  // --- La conexión ----------------------------------------------------------
  useEffect(() => {
    if (!canalSala || !configurada || !perfil) return;
    let cancelado = false;
    let cliente: ClientePusher | null = null;
    sincronizadoRef.current = false;
    ordenRef.current = [];

    const nombres = new Map<string, string>();
    const publicar = () => {
      setMiembros(ordenRef.current.map((id) => ({ id, nombre: nombres.get(id) ?? "Alguien" })));
    };

    const avisar = (de: string | undefined, que: AvisoSala["que"]) => {
      const nombre = de ? nombres.get(de) : undefined;
      if (!nombre) return;
      avisosRef.current += 1;
      setAviso({ nombre, que, n: avisosRef.current });
    };

    const recibir = (dato: unknown, metadatos?: { user_id?: string }) => {
      const mensaje = leerMensaje(dato);
      if (!mensaje || cancelado) return;
      const de = metadatos?.user_id;

      if (mensaje.tipo === "hola") {
        if (peliculaRef.current) enviar({ tipo: "video", pelicula: peliculaRef.current });
        if (dirijoRef.current) {
          const actual = estadoActual();
          if (actual) enviar(actual);
        }
        return;
      }
      if (mensaje.tipo === "video") {
        adoptar(mensaje.pelicula);
        // Si la suya era más vieja, se le cuenta la nuestra. Se compara por
        // versión y autor, no por objeto: antes, recibir la MISMA película (un
        // objeto nuevo) se tomaba por distinta, se contestaba, y los aparatos
        // se respondían en bucle sin fin.
        const mia = peliculaRef.current;
        if (esMasNueva(mia, mensaje.pelicula)) enviar({ tipo: "video", pelicula: mia! });
        return;
      }
      if (mensaje.tipo === "empezar") {
        lanzarCuenta();
        return;
      }
      // Estado. El pulso solo lo sigue quien no dirige; lo demás —un play, una
      // pausa o un salto de cualquiera— lo siguen todos.
      if (mensaje.pulso && dirijoRef.current) return;
      const v = elementoRef.current;
      if (!mensaje.pulso && v) {
        if (mensaje.pausado && !v.paused) avisar(de, "pausó");
        else if (!mensaje.pausado && v.paused) avisar(de, "reanudó");
        else if (Math.abs(v.currentTime - mensaje.tiempo) > 10) avisar(de, "saltó");
      }
      aplicar(mensaje.tiempo, mensaje.pausado);
    };

    (async () => {
      try {
        // Carga diferida: solo quien entra en la sala paga estos KB.
        const { default: Pusher } = await import("pusher-js");
        if (cancelado) return;
        cliente = new Pusher(publicConfig.pusherKey, {
          cluster: publicConfig.pusherCluster,
          channelAuthorization: {
            endpoint: "/api/pusher/auth",
            transport: "ajax",
            // Quién eres: la ruta lo pone en la presencia tal cual (el alias,
            // limpio). No hay cuentas; se comprueba a ojo.
            params: { id: perfil.id, nombre: perfil.nombre },
          },
        }) as unknown as ClientePusher;

        const canal = cliente.subscribe(canalSala);
        canalRef.current = canal;
        canal.bind("pusher:subscription_succeeded", (dato) => {
          if (cancelado) return;
          suscritoRef.current = true;
          // Los que ya estaban, antes; yo, al final. Entre ellos, por id, para
          // que todos vean el mismo orden.
          const otros: string[] = [];
          nombres.clear();
          (dato as MiembrosPusher | undefined)?.each((m) => {
            nombres.set(m.id, nombreDe(m));
            if (m.id !== perfil.id) otros.push(m.id);
          });
          nombres.set(perfil.id, perfil.nombre);
          ordenRef.current = [...otros.sort(), perfil.id];
          publicar();
          setConexion({ canal: canalSala, estado: "conectada" });
          // Quien llega pide el estado, y cuenta su película: la más nueva gana.
          // Esto corre también al reconectar.
          enviar({ tipo: "hola" });
          if (peliculaRef.current) enviar({ tipo: "video", pelicula: peliculaRef.current });
          if (ordenRef.current[0] === perfil.id) sincronizadoRef.current = true;
        });
        canal.bind("pusher:member_added", (dato) => {
          const m = dato as MiembroPusher;
          if (cancelado || !m?.id) return;
          nombres.set(m.id, nombreDe(m));
          if (!ordenRef.current.includes(m.id)) ordenRef.current = [...ordenRef.current, m.id];
          publicar();
        });
        canal.bind("pusher:member_removed", (dato) => {
          const m = dato as MiembroPusher;
          if (cancelado || !m?.id) return;
          ordenRef.current = ordenRef.current.filter((id) => id !== m.id);
          publicar();
        });
        canal.bind("pusher:subscription_error", () => {
          if (!cancelado) setConexion({ canal: canalSala, estado: "error" });
        });
        canal.bind(EVENTO, recibir);
        cliente.connection.bind("error", () => {
          if (!cancelado) setConexion({ canal: canalSala, estado: "error" });
        });
        // Sin conexión no hay suscripción: lo que se mande ahí se pierde, y
        // al volver `subscription_succeeded` lo pone otra vez en marcha.
        cliente.connection.bind("state_change", (cambio) => {
          if (cambio?.current !== "connected") suscritoRef.current = false;
        });
      } catch (error) {
        console.error("❌ Ver juntos: no se pudo conectar", error);
        if (!cancelado) setConexion({ canal: canalSala, estado: "error" });
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
       * Quien se va, pausa a todos.
       *
       * Esto corre también al salir de Mi enlace sin salir de la sala —pulsar
       * Atrás en el mando—, porque la vista se oculta y sus efectos se
       * limpian. El `<video>` local ya se pausa solo al ocultarse (ver
       * `NativePlayer`), pero esa pausa llega cuando el canal ya se cerró: el
       * otro seguía viendo la película solo, y al volver iban desfasados.
       */
      const v = elementoRef.current;
      let despedida = false;
      if (suscritoRef.current && v && !v.paused && (dirijoRef.current || sincronizadoRef.current)) {
        enviar({ tipo: "estado", tiempo: v.currentTime, pausado: true });
        despedida = true;
      }
      cancelado = true;
      suscritoRef.current = false;
      canalRef.current = null;
      ordenRef.current = [];
      setMiembros([]);
      const colgar = () => {
        try {
          // Desconectar ya da de baja el canal; darlo de baja antes mandaba
          // un mensaje más por un socket que se estaba cerrando.
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
  }, [canalSala, configurada, perfil, enviar, estadoActual, aplicar, adoptar, lanzarCuenta]);

  // --- Lo que hace el vídeo local, se cuenta --------------------------------
  useEffect(() => {
    if (!elemento || !canalSala) return;
    const contar = (evento: Event) => {
      if (desbloqueandoRef.current) return;
      // Lo que acabamos de aplicar desde fuera es eco: no se devuelve.
      const ahora = { tiempo: elemento.currentTime, pausado: elemento.paused };
      if (esEco(esperadoRef.current, ahora, Date.now(), TOLERANCIA_S, evento.type as "play" | "pause" | "seeked")) {
        return;
      }
      if (pendienteRef.current) return;
      if (!dirijoRef.current && !sincronizadoRef.current) return;
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
    if (arrancarAlLlegarRef.current) {
      arrancarAlLlegarRef.current = false;
      arrancar(elemento, elemento.currentTime);
    }
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
  }, [elemento, canalSala, enviar, estadoActual, aplicar, arrancar]);

  // --- Pulso de quien dirige ------------------------------------------------
  useEffect(() => {
    if (estado !== "conectada" || !dirijo) return;
    const id = window.setInterval(() => {
      const actual = estadoActual(true);
      if (actual) enviar(actual);
    }, PULSO_MS);
    return () => window.clearInterval(id);
  }, [estado, dirijo, enviar, estadoActual]);

  // --- El aviso «Steven pausó» se va solo -----------------------------------
  useEffect(() => {
    if (!aviso) return;
    const id = window.setTimeout(() => setAviso(null), AVISO_MS);
    return () => window.clearTimeout(id);
  }, [aviso]);

  const conectada = estado === "conectada";
  return {
    estado,
    /** Quién está en la sala, por orden de llegada, este aparato incluido. */
    miembros: conectada ? miembros : [],
    yo,
    pelicula,
    elegir,
    /** Este aparato dirige (su pulso corrige a los demás). */
    dirijo,
    cuenta,
    empezar,
    irA,
    aviso,
    necesitaToque,
    silenciadoPorSala,
    unirse,
    activarSonido,
    /** Para `NativePlayer`: le dice a la sala cuál es el `<video>`. */
    alVideo: setElemento,
  };
}
