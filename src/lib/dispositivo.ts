/**
 * ¿Es un iPhone (o un iPod)?
 *
 * Deliberadamente **no** incluye el iPad: ahí la Fullscreen API sí funciona
 * sobre elementos normales, y usar el reproductor del sistema sacrificaría
 * nuestros controles sin ganar nada. Y el iPad moderno se anuncia como
 * "Macintosh", así que buscarlo por nombre tampoco serviría.
 *
 * Lo consumen los dos reproductores y el hook de pantalla completa para
 * decidir cuándo la única vía es el reproductor nativo del sistema.
 */
export function esIPhone(): boolean {
  return /iPhone|iPod/.test(navigator.userAgent);
}

/**
 * ¿Es una tableta (iPad o Android sin "Mobile")?
 *
 * El iPad se anuncia como "Macintosh", así que se busca por el nombre
 * explícito. Las Android tabletas no tienen "Mobile" en el UA.
 */
export function esTableta(): boolean {
  return /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
}

/**
 * ¿Es un display inteligente (Google Nest Hub, Amazon Fire TV Stick,
 * dispositivos tipo "computadora de TV")?
 *
 * Se distingue de las tabletas por no tener "Mobile" en el UA y no ser iPad,
 * y de los televisores por no tener las siglas de marca conocidas de TV.
 */
export function esDisplayInteligente(): boolean {
  const ua = navigator.userAgent;
  return (
    /Android/i.test(ua) &&
    /Mobile|Tablet/.test(ua) === false &&
    /iPad/.test(ua) === false &&
    !/(Tizen|Web0S|WebOS|SmartTV|Smart-TV|HbbTV|NetCast|VIDAA|BRAVIA|AppleTV|GoogleTV|Android TV|CrKey|Roku|PhilipsTV|AFT[A-Z])/i.test(
      ua,
    )
  );
}

/**
 * ¿Se está usando un mando (DPAD) vs pantalla táctil?
 *
 * En televisores y displays inteligentes el puntero es "coarse" y las
 * flechas del teclado son los códigos de mando reales. En teléfonos/tabletas
 * es "fine" touch. Este hook actualiza el atributo `data-input` en <html>.
 */
export function usarMando(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

/**
 * ¿Es el navegador de un televisor?
 *
 * Se decide con el `User-Agent` para poder hacerlo en el SERVIDOR: la ficha
 * elige un servidor de respaldo en el primer render, y corregirlo al hidratar
 * llegaría tarde —el marco ya habría empezado a cargar—.
 *
 * Para qué se usa: en un televisor, VidSrc deja de ir primero. Su puerta de
 * Cloudflare Turnstile necesita un navegador moderno, y el de una Samsung Tizen
 * no lo es; cuando la puerta falla se recarga sola, sin fin. Ahí sus subtítulos
 * no están realmente disponibles —no hay vídeo que subtitular—, así que lo
 * honesto es arrancar en uno que reproduzca y dejar VidSrc a un botón,
 * etiquetado, para quien quiera intentarlo (a veces pasa).
 *
 * Un falso positivo no rompe nada: como mucho reordena los servidores.
 */
export function esTelevisorUA(userAgent: string): boolean {
  return /Tizen|Web0S|WebOS|SmartTV|Smart-TV|HbbTV|NetCast|VIDAA|BRAVIA|AppleTV|GoogleTV|Android TV|CrKey|Roku|PhilipsTV|AFT[A-Z]/i.test(
    userAgent,
  );
}

/**
 * Versión granular del detector de televisor.
 * Devuelve el nombre de plataforma o null si no es TV.
 *
 * Usado en el renderizador servidor-side para elegir el servidor de respaldo
 * correcto en el primer render (el UA no cambia al hidratar).
 */
export function versionTV(): string | null {
  const ua = navigator.userAgent;
  const plataformas: Record<string, string> = {
    Tizen: "samsung-tizen",
    Web0S: "webos-old",
    WebOS: "webos",
    SmartTV: "tv-generico",
    "Smart-TV": "tv-generico",
    HbbTV: "tv-generico",
    NetCast: "lg-webos-v2",
    VIDAA: "philips-hbbtv",
    BRAVIA: "sony-bravia",
    AppleTV: "apple-tv",
    GoogleTV: "google-tv",
    "Android TV": "android-tv",
    CrKey: "chromecast-build",
    Roku: "rokudeveloper",
    PhilipsTV: "philips-tv",
    AFT: "amazon-fire-tv",
  };

  for (const [patron, version] of Object.entries(plataformas)) {
    if (new RegExp(patron, "i").test(ua)) {
      return version;
    }
  }
  return null;
}