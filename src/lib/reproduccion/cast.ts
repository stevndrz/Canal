/**
 * Las decisiones puras de transmitir a una TV.
 *
 * Están fuera de `use-cast.ts` por la misma razón que `motor.ts` salió de
 * `stream-player.tsx`: son reglas que se pueden razonar y probar sin montar un
 * componente, sin SDK de Google y sin un Chromecast delante. Que no se pudieran
 * probar es parte de por qué esto se «arregló» dos veces sin arreglarse.
 *
 * Aquí no se toca el DOM ni estado de React.
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
 * Contenedor de los fragmentos HLS, para el receptor.
 *
 * **La pieza que faltaba para las listas IPTV.** El receptor por defecto de
 * Google (CAF) no adivina el contenedor de un HLS: si el manifiesto apunta a
 * fragmentos MPEG-2 TS —lo que usa prácticamente toda lista IPTV— y el emisor
 * no lo declara, la carga falla con `load_failed` y el Chromecast vuelve a su
 * pantalla de fondo. Desde el sofá eso es exactamente lo que se reportó: sale
 * el selector, eliges la tele, y no pasa nada.
 *
 * Los valores viven en enums del SDK, pero no en todas sus versiones; los
 * literales de respaldo son los que el receptor espera de todos modos.
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
