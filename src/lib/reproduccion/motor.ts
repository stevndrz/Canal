import type HlsType from "hls.js";
import { extensionDe } from "@/lib/extension";
import type MpegtsType from "mpegts.js";


/**
 * Qué librería reproduce cada enlace, y cómo se conecta al `<video>`. Vivía
 * dentro del efecto de `stream-player.tsx`, que además llevaba el estado de
 * React, el autoplay y la limpieza; separado se puede razonar sin montar un
 * componente.
 *
 * Aquí **no se toca estado de React**: lo que hay que comunicar sale por
 * `alPoderReproducir` y `alFallar`.
 */

export type ClaseDeEmision = "hls" | "mpegts" | "flv" | "native";

export type CalidadVideo = "auto" | "480p" | "720p" | "1080p";

/** Alturas máximas por escalón del selector. */
export const ALTURA_POR_CALIDAD: Record<Exclude<CalidadVideo, "auto">, number> = {
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
};

/**
 * La calidad efectiva, resolviendo el ajuste viejo.
 *
 * `calidadMaxima` era un booleano (todo o nada). Los ajustes guardados en los
 * aparatos todavía lo traen sin `calidad`: como la fusión con los valores por
 * defecto rellena `calidad: "auto"`, un `"auto"` con `calidadMaxima: true` se
 * lee como intención vieja (1080p). El selector nuevo escribe los dos campos a
 * la vez, así que un auto elegido de verdad llega con `calidadMaxima: false`.
 */
export function resolverCalidad(
  calidad: CalidadVideo | undefined,
  calidadMaxima?: boolean,
): CalidadVideo {
  if (calidad === "auto" && calidadMaxima) return "1080p";
  if (calidad) return calidad;
  return calidadMaxima ? "1080p" : "auto";
}

/**
 * El índice de nivel más alto que entra en la altura pedida.
 *
 * Las alturas de hls.js vienen de los manifiestos y no siempre son exactas
 * (576, 540…): se acepta todo lo que no supere el tope. Sin niveles o sin tope
 * (`auto`) no se limita nada y se devuelve -1, que en hls.js es «automático».
 */
export function nivelMaxParaCalidad(
  alturas: (number | undefined)[],
  calidad: CalidadVideo,
): number {
  if (calidad === "auto" || alturas.length === 0) return -1;
  const tope = ALTURA_POR_CALIDAD[calidad];
  let mejor = -1;
  for (let i = 0; i < alturas.length; i += 1) {
    const altura = alturas[i] ?? 0;
    if (altura > 0 && altura <= tope) mejor = i;
  }
  // Todo supera el tope (solo hay 1080p y se pidió 480p): el más bajo sigue
  // siendo mejor que no poner nada.
  if (mejor === -1) {
    let menor = 0;
    for (let i = 1; i < alturas.length; i += 1) {
      if ((alturas[i] ?? Infinity) < (alturas[menor] ?? Infinity)) menor = i;
    }
    return menor;
  }
  return mejor;
}

/**
 * Por defecto se asume HLS: es el formato dominante en listas IPTV públicas,
 * incluso cuando la URL no termina en `.m3u8`.
 *
 * Comparte con `claseDeUrl` de dónde saca la extensión, no el vocabulario. Que
 * las dos sigan de acuerdo lo comprueba `extension.test.ts`, no un comentario:
 * el que había nombraba una función que llevaba tiempo sin existir.
 */
export function claseDeEmision(url: string): ClaseDeEmision {
  switch (extensionDe(url)) {
    case "flv":
      return "flv";
    case "ts":
      return "mpegts";
    case "mp4":
    case "webm":
    case "mkv":
    case "mov":
      return "native";
    // Lo desconocido cae en HLS, que es lo que emite casi toda lista M3U.
    default:
      return "hls";
  }
}

/**
 * `hls.js` y `mpegts.js` se cargan solo al reproducir. Segunda capa de la misma
 * defensa que el `next/dynamic({ ssr: false })`: si algo evaluara este módulo
 * en el servidor, un `import` de nivel de módulo tocaría `self` y tumbaría la
 * página. Cada uno se pide una vez — la promesa queda cacheada.
 */
let moduloHls: Promise<typeof HlsType> | null = null;
let moduloMpegts: Promise<typeof MpegtsType> | null = null;

function cargarHls(): Promise<typeof HlsType> {
  moduloHls ??= import("hls.js").then((m) => m.default);
  return moduloHls;
}

function cargarMpegts(): Promise<typeof MpegtsType> {
  moduloMpegts ??= import("mpegts.js").then((m) => m.default);
  return moduloMpegts;
}

/** Lo que hay que destruir al cambiar de canal o desmontar. */
export interface MotorMontado {
  hls: HlsType | null;
  mpegts: ReturnType<typeof MpegtsType.createPlayer> | null;
}

/**
 * Solo los ajustes que el motor usa de verdad, no el paquete entero.
 *
 * Importa porque el efecto que llama aquí se vuelve a ejecutar cuando cambian
 * sus dependencias, y volver a ejecutarlo **reinicia la emisión**. Con el
 * objeto de ajustes completo, tocar «controles grandes» —que no tiene nada que
 * ver— cortaría el canal y lo volvería a cargar.
 */
export interface AjustesMotor {
  enableWorker: boolean;
  lowLatencyMode: boolean;
  liveBufferLatencyChasing: boolean;
  calidadMaxima: boolean;
  /** Selector nuevo. Ausente en ajustes viejos: lo resuelve `resolverCalidad`. */
  calidad?: CalidadVideo;
}

export interface ConfigHlsResuelta {
  startLevel: number;
  capLevelToPlayerSize: boolean;
  maxMaxBufferLength: number;
}

/**
 * Qué configuración de arranque sale de la calidad pedida, sin hls.js delante
 * para poder probarla. `auto` mantiene el ABR clásico (empieza bajo y sube);
 * cualquier escalón arranca arriba y deja de capar por tamaño del reproductor.
 */
export function configArranqueParaCalidad(calidad: CalidadVideo): ConfigHlsResuelta {
  if (calidad === "auto") {
    return { startLevel: -1, capLevelToPlayerSize: true, maxMaxBufferLength: 40 };
  }
  return { startLevel: Infinity, capLevelToPlayerSize: false, maxMaxBufferLength: 60 };
}

/**
 * Aplica el escalón a una instancia viva de hls.js: limita el nivel máximo y,
 * si el actual se queda fuera, baja a él. No-op defensivo si la instancia no
 * trae niveles (versión vieja, HLS nativo).
 */
export function fijarCalidad(
  hls: {
    levels?: { height?: number }[];
    currentLevel?: number;
    nextLevel?: number;
    loadLevel?: number;
  } | null | undefined,
  calidad: CalidadVideo,
): void {
  if (!hls || !Array.isArray(hls.levels) || hls.levels.length === 0) return;
  // hls.js usa -1 como «automático»: con auto se suelta el tope y se deja al ABR.
  const max = nivelMaxParaCalidad(
    hls.levels.map((n) => n?.height),
    calidad,
  );
  if (max < 0) {
    if (typeof hls.nextLevel === "number") hls.nextLevel = -1;
    if (typeof hls.loadLevel === "number") hls.loadLevel = -1;
    return;
  }
  if (typeof hls.currentLevel === "number" && hls.currentLevel > max) {
    hls.currentLevel = max;
  } else if (typeof hls.nextLevel === "number") {
    hls.nextLevel = Math.min(hls.nextLevel < 0 ? max : hls.nextLevel, max);
  }
}

/**
 * Pre-conecta con el origen del siguiente canal probable (anterior/siguiente
 * en el zapeo). No descarga nada —un `fetch` dispararía CORS en la mitad de
 * los proveedores—: solo ahorra el DNS+TLS del manifiesto cuando se zapee.
 */
export function precargarCanal(url: string): void {
  try {
    const origen = new URL(url, window.location.href).origin;
    if (document.querySelector(`link[rel="preconnect"][href="${origen}"]`)) return;
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = origen;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  } catch {
    /* URL rara: no hay nada que pre-conectar */
  }
}

export interface OpcionesMotor {
  video: HTMLVideoElement;
  url: string;
  clase: ClaseDeEmision;
  settings: AjustesMotor;
  /** El canal cambió mientras se cargaba la librería: hay que abandonar. */
  cancelado: () => boolean;
  alPoderReproducir: () => void;
  alFallar: () => void;
}

/**
 * Conecta el motor que corresponda y devuelve lo que habrá que destruir.
 *
 * `cancelado()` se consulta **después de cada espera**: entre pedir la
 * librería y recibirla puede haberse cambiado de canal, y seguir adelante
 * dejaría dos motores peleándose por el mismo `<video>`.
 */
export async function montarMotor(opciones: OpcionesMotor): Promise<MotorMontado> {
  const { clase } = opciones;
  if (clase === "hls") return montarHls(opciones);
  if (clase === "mpegts" || clase === "flv") return montarMpegts(opciones);
  return montarNativo(opciones);
}

/**
 * ¿Toca reproducir HLS sin librería aunque exista MSE? AirPlay solo transmite
 * la reproducción **nativa**: alimentado por MSE, el selector de Safari sale
 * pero la tele se queda en negro. Los WebKit con AirPlay leen HLS por su
 * cuenta, así que ahí va directo y hls.js queda para Chrome, Firefox y Android.
 */
export function prefiereNativoPorAirplay(video: HTMLVideoElement): boolean {
  return (
    typeof video.canPlayType === "function" &&
    video.canPlayType("application/vnd.apple.mpegurl") !== "" &&
    typeof window.WebKitPlaybackTargetAvailabilityEvent !== "undefined"
  );
}

/**
 * Política única de recuperación de hls.js, compartida por canales y por
 * pelis/series. Un fallo de red se recarga; uno de medios se recupera UNA vez
 * — dos seguidas y hls.js vacía el búfer y reemite el mismo fragmento, que es
 * el «se repite un trozo y queda en bucle» de los televisores con MSE
 * defectuoso. Agotados los intentos, abandona y decide quien llama.
 */
export const INTENTOS_RECUPERACION = 3;

export interface EstadoRecuperacion {
  intentos: number;
  mediosRecuperados: boolean;
}

export type PlanAnteError = "reintentar-red" | "reintentar-medios" | "abandonar";

export function planAnteErrorFatal(
  estado: EstadoRecuperacion,
  tipo: "red" | "medios" | "otro",
): PlanAnteError {
  if (tipo === "otro") return "abandonar";
  if (estado.intentos >= INTENTOS_RECUPERACION) return "abandonar";
  if (tipo === "medios" && estado.mediosRecuperados) return "abandonar";
  return tipo === "red" ? "reintentar-red" : "reintentar-medios";
}

async function montarHls(o: OpcionesMotor): Promise<MotorMontado> {
  const Hls = await cargarHls();
  if (o.cancelado()) return vacio();

  // Sin MSE, o en un WebKit con AirPlay, el HLS va nativo. Ver
  // `prefiereNativoPorAirplay`.
  if (!Hls.isSupported() || prefiereNativoPorAirplay(o.video)) {
    o.video.src = o.url;
    o.video.addEventListener("loadedmetadata", o.alPoderReproducir, { once: true });
    return vacio();
  }

  const calidad = resolverCalidad(o.settings.calidad, o.settings.calidadMaxima);
  const arranque = configArranqueParaCalidad(calidad);
  const hls = new Hls({
    enableWorker: o.settings.enableWorker,
    lowLatencyMode: o.settings.lowLatencyMode,
    /**
     * Con escalón fijo se arranca en la mejor pista y se deja de limitar por
     * el tamaño del reproductor (ver `configArranqueParaCalidad`).
     *
     * `startLevel: -1` empieza bajo y sube midiendo la conexión, lo que con
     * una línea justa evita cortes pero con fibra son unos segundos borrosos
     * en cada zapeo. Y `capLevelToPlayerSize` ata la pista al tamaño en
     * píxeles: ahorra datos, pero con el vídeo a media pantalla impide subir a
     * 1080 aunque la haya.
     */
    startLevel: arranque.startLevel,
    capLevelToPlayerSize: arranque.capLevelToPlayerSize,
    /**
     * Red y búfer para vivo inestable: reintentos con espera en vez de rendirse
     * al primer fragmento malo, y búfer corto para no quedarse colgado lejos
     * del directo tras un tirón.
     */
    fragLoadingMaxRetry: 4,
    manifestLoadingMaxRetry: 2,
    levelLoadingMaxRetry: 3,
    fragLoadingRetryDelay: 800,
    manifestLoadingRetryDelay: 1000,
    levelLoadingRetryDelay: 1000,
    maxBufferLength: 20,
    maxMaxBufferLength: arranque.maxMaxBufferLength,
    maxBufferSize: 60 * 1000 * 1000,
    liveSyncDurationCount: 3,
    abrEwmaFastLive: 3,
    abrEwmaSlowLive: 9,
    abrBandWidthFactor: 0.8,
    backBufferLength: 30,
  });

  /**
   * Recuperación acotada según la política común (`planAnteErrorFatal`):
   * abandonar aquí es declarar la señal caída.
   */
  const recuperacion: EstadoRecuperacion = { intentos: 0, mediosRecuperados: false };
  hls.on(Hls.Events.ERROR, (_evento, datos) => {
    if (!datos.fatal || o.cancelado()) return;
    const plan = planAnteErrorFatal(
      recuperacion,
      datos.type === Hls.ErrorTypes.NETWORK_ERROR
        ? "red"
        : datos.type === Hls.ErrorTypes.MEDIA_ERROR
          ? "medios"
          : "otro",
    );
    if (plan === "abandonar") {
      o.alFallar();
      return;
    }
    recuperacion.intentos++;
    if (plan === "reintentar-medios") {
      recuperacion.mediosRecuperados = true;
      hls.recoverMediaError();
    } else {
      hls.startLoad();
    }
  });
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    // El manifiesto ya trae los niveles: se aplica el escalón antes del primer
    // `play()` para no enseñar un segundo en 1080 cuando se pidió 480p.
    try {
      fijarCalidad(
        hls as unknown as Parameters<typeof fijarCalidad>[0],
        calidad,
      );
    } catch {
      /* limitar es un extra: nunca puede tumbar el arranque */
    }
    o.alPoderReproducir();
  });
  hls.loadSource(o.url);
  hls.attachMedia(o.video);

  return { hls, mpegts: null };
}

async function montarMpegts(o: OpcionesMotor): Promise<MotorMontado> {
  const mpegts = await cargarMpegts();
  if (o.cancelado()) return vacio();

  if (!mpegts.isSupported()) return montarNativo(o);

  const reproductor = mpegts.createPlayer(
    { type: o.clase === "flv" ? "flv" : "mpegts", url: o.url, isLive: true },
    {
      enableWorker: o.settings.enableWorker,
      liveBufferLatencyChasing: o.settings.liveBufferLatencyChasing,
    },
  );

  reproductor.on(mpegts.Events.ERROR, o.alFallar);
  reproductor.attachMediaElement(o.video);
  reproductor.load();
  o.alPoderReproducir();

  return { hls: null, mpegts: reproductor };
}

/** Sin librería: el `<video>` se apaña solo con un .mp4 o un .webm. */
function montarNativo(o: OpcionesMotor): MotorMontado {
  o.video.src = o.url;
  o.alPoderReproducir();
  return vacio();
}

function vacio(): MotorMontado {
  return { hls: null, mpegts: null };
}
