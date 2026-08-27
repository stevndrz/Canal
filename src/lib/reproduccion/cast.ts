/**
 * Las decisiones puras de transmitir a una TV, fuera de `use-cast.ts` por lo
 * mismo que `motor.ts` salió de `stream-player.tsx`: se pueden probar sin
 * componente, sin SDK y sin un Chromecast delante. Que no se pudieran probar
 * es parte de por qué esto se «arregló» dos veces sin arreglarse.
 */

/** Lo que se le declara al receptor sobre un medio HLS. */
export interface FormatoHls {
  segmento: string;
  video: string;
}

/**
 * Tipo de contenido para el receptor.
 *
 * Casi toda la lista es HLS, pero mandar `x-mpegurl` para un MPD hace que el
 * receptor lo rechace, y ese rechazo es justo lo que dejaba la sesión colgada.
 */
export function tipoDeContenido(url: string): string {
  const ruta = url.split("?")[0].toLowerCase();
  if (ruta.endsWith(".mpd")) return "application/dash+xml";
  if (ruta.endsWith(".mp4")) return "video/mp4";
  if (ruta.endsWith(".webm")) return "video/webm";
  return "application/x-mpegurl";
}

/** ¿Este medio necesita que le declaremos el contenedor de los fragmentos? */
export function esHls(tipoContenido: string): boolean {
  return tipoContenido === "application/x-mpegurl";
}

/**
 * Contenedor de los fragmentos HLS, para el receptor. **La pieza que faltaba
 * para las listas IPTV**: el receptor de Google (CAF) no adivina el contenedor,
 * así que con fragmentos MPEG-2 TS —lo que usa casi toda lista IPTV— sin
 * declarar, la carga falla con `load_failed`. Desde el sofá: sale el selector,
 * eliges la tele, y no pasa nada.
 *
 * Los enums no están en todas las versiones del SDK; los literales de respaldo
 * son los que el receptor espera igualmente.
 */
export function formatoHls(
  enumSegmento?: Record<string, string>,
  enumVideo?: Record<string, string>,
): FormatoHls {
  return {
    segmento: enumSegmento?.TS ?? "ts",
    video: enumVideo?.MPEG2_TS ?? "mpeg2_ts",
  };
}

/** Cerrar el selector de pantallas no es un error que merezca avisar. */
export function esCancelacion(error: unknown): boolean {
  const codigo = (error as { code?: string })?.code ?? String(error ?? "");
  return /cancel/i.test(codigo);
}

/**
 * Traduce un fallo del SDK a algo que se pueda leer desde el sofá.
 *
 * Antes todo error acababa en la misma frase genérica y el motivo real solo
 * existía en la consola — que en una tele o en un teléfono no se abre. Sin el
 * código no hay forma de distinguir «esta pantalla no soporta el formato» de
 * «se cayó la red», que se arreglan de maneras distintas. El código va detrás
 * del mensaje, entre paréntesis, para poder decirlo por teléfono a quien
 * pueda hacer algo con él.
 */
export function describirErrorCast(error: unknown): string {
  const fallo = error as { code?: string; description?: string | null } | null;
  const codigo = fallo?.code ?? "";

  const base =
    codigo === "load_failed"
      ? "La pantalla no pudo abrir esta emisión: casi siempre es que el canal rechaza al Chromecast o que su formato no le entra."
      : codigo === "timeout"
        ? "La pantalla tardó demasiado en responder."
        : codigo === "session_error"
          ? "Se perdió la conexión con la pantalla."
          : codigo === "channel_error"
            ? "Se cortó la comunicación con la pantalla. Comprueba que sigue en la misma red."
            : "No se pudo transmitir a esa pantalla.";

  const detalle = [codigo, fallo?.description].filter(Boolean).join(" · ");
  return detalle ? `${base} (${detalle})` : base;
}

/**
 * En qué punto está Google Cast, sin las cadenas del SDK.
 *
 * `sin-pantallas` no es «desconectado»: es «Google Cast no tiene nada que
 * decir aquí», y eso importa porque AirPlay puede estar emitiendo por su
 * cuenta en ese mismo momento.
 */
export type EstadoCast = "sin-pantallas" | "no-conectado" | "conectando" | "conectado";

/**
 * ¿Sigue habiendo emisión después de un cambio de estado del SDK?
 *
 * **`conectado` NO significa que se esté viendo algo en la tele.** Significa
 * que el teléfono habló con el Chromecast. Confundir las dos cosas es lo que
 * dejaba el botón inservible: si la conexión se establecía y la carga del
 * canal fallaba, el botón pasaba a «Dejar de transmitir» sin haber transmitido
 * nada, y el siguiente toque cerraba una sesión muerta en lugar de volver a
 * abrir el selector de pantallas. Desde fuera, el botón había dejado de
 * funcionar y solo recargar la página lo devolvía a la vida.
 *
 * Así que la emisión solo se **enciende** cuando `loadMedia` termina bien.
 * Esta función únicamente decide cuándo se apaga.
 */
export function emisionTrasEstado(emitiendo: boolean, estado: EstadoCast): boolean {
  // Google Cast no manda aquí: no se toca lo que haya puesto AirPlay.
  if (estado === "sin-pantallas") return emitiendo;
  return estado === "conectado" ? emitiendo : false;
}
