import type HlsType from "hls.js";
import type MpegtsType from "mpegts.js";


/**
 * Qué librería reproduce cada enlace, y cómo se conecta al `<video>`.
 *
 * Vivía dentro del efecto de `stream-player.tsx`: sesenta líneas de `if`
 * anidados en medio de un efecto que además gestionaba el estado de React, el
 * autoplay y la limpieza. Separado, se ve de un vistazo qué hace cada motor y
 * se puede razonar sobre él sin montar un componente.
 *
 * Aquí **no se toca estado de React**. Lo que hace falta comunicar sale por
 * las dos devoluciones de llamada: `alPoderReproducir` y `alFallar`.
 */

export type ClaseDeEmision = "hls" | "mpegts" | "flv" | "native";

/**
 * Por defecto se asume HLS: es el formato dominante en listas IPTV públicas,
 * incluso cuando la URL no termina en `.m3u8`.
 *
 * Misma regla que `claseDeUrl` en `src/lib/fuente-propia/url.ts`, a propósito:
 * si un día cambia una, tiene que cambiar la otra.
 */
export function claseDeEmision(url: string): ClaseDeEmision {
  const limpia = url.toLowerCase().split("?")[0];
  if (/\.flv$/.test(limpia)) return "flv";
  if (/\.ts$/.test(limpia)) return "mpegts";
  if (/\.(mp4|webm|mkv|mov)$/.test(limpia)) return "native";
  return "hls";
}

/**
 * `hls.js` y `mpegts.js` se cargan solo cuando hace falta reproducir.
 *
 * Segunda capa de la misma defensa que el `next/dynamic({ ssr: false })` de
 * los componentes: si algo llegara a evaluar este módulo en el servidor pese a
 * esa frontera, un `import` de nivel de módulo tocaría `self` y tumbaría la
 * página igual. Con `await import()` dentro de la función, el servidor nunca
 * llega a evaluarlos. Cada uno se pide una vez: la promesa queda cacheada.
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
 * ¿Toca reproducir HLS sin librería aunque exista MSE?
 *
 * AirPlay solo transmite la reproducción **nativa** del `<video>`: si el medio
 * se alimenta por MSE (hls.js), el selector de Safari aparece pero la tele se
 * queda en negro. Los WebKit que tienen AirPlay también leen HLS por su cuenta,
 * así que ahí el flujo va directo al vídeo y hls.js queda reservado para los
 * navegadores que sí lo necesitan (Chrome, Firefox, Android), donde además es
 * lo que hace posible Chromecast mandar la URL al receptor.
 */
export function prefiereNativoPorAirplay(video: HTMLVideoElement): boolean {
  return (
    typeof video.canPlayType === "function" &&
    video.canPlayType("application/vnd.apple.mpegurl") !== "" &&
    typeof window.WebKitPlaybackTargetAvailabilityEvent !== "undefined"
  );
}

/**
 * Política única de recuperación de emisiones hls.js, compartida por el motor
 * de canales y el reproductor de pelis/series.
 *
 * Un fallo de red se recarga; uno de medios se recupera UNA sola vez —
 * llamarlo dos veces seguidas hace que hls.js vacíe el búfer y vuelva a
 * emitir el mismo fragmento, exactamente el «se repite un trozo y queda en
 * bucle» que se veía en televisores con MSE defectuoso. Fuera de eso, o al
 * agotar los intentos, toca abandonar y dejar que cada llamada decida su
 * último recurso.
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

  const hls = new Hls({
    enableWorker: o.settings.enableWorker,
    lowLatencyMode: o.settings.lowLatencyMode,
    /**
     * Con «calidad máxima» se arranca en la mejor pista y se deja de limitar
     * por el tamaño del reproductor.
     *
     * `startLevel: -1` es el comportamiento normal —empezar bajo y subir
     * según se mide la conexión—, que con una línea justa evita cortes. Con
     * fibra esa prudencia se nota como unos segundos borrosos en cada cambio
     * de canal, y `Infinity` pide directamente la más alta que exista.
     *
     * `capLevelToPlayerSize` limita la pista al tamaño en píxeles del
     * reproductor: ahorra datos, pero en un televisor con el vídeo a media
     * pantalla impide subir a 1080 aunque la haya.
     */
    startLevel: o.settings.calidadMaxima ? Infinity : -1,
    capLevelToPlayerSize: !o.settings.calidadMaxima,
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
  hls.on(Hls.Events.MANIFEST_PARSED, o.alPoderReproducir);
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
