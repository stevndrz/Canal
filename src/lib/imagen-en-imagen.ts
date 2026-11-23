/**
 * Imagen en imagen (PiP): el vídeo en una ventanita que flota sobre las demás
 * apps mientras se hace otra cosa.
 *
 * Hay dos vías y hacen falta las dos:
 *
 * - **La estándar** (`requestPictureInPicture`): Chrome, Edge, Android y
 *   Safari de Mac.
 * - **La de WebKit** (`webkitSetPresentationMode`): Safari de iPhone y iPad,
 *   también con la app instalada en la pantalla de inicio. Solo con la
 *   estándar, en el iPhone el botón no hacía nada.
 *
 * Antes el botón salía también donde no hay ninguna de las dos (Firefox, las
 * teles con Chromium viejo): un botón que no hace nada. Ahora solo sale si
 * alguna de las dos existe de verdad.
 *
 * Sin React a propósito: así se prueba con objetos de mentira y lo usan igual
 * el reproductor propio y el del directo (`use-imagen-en-imagen.ts`).
 */

/** Lo que se usa de un `<video>`, incluidas las extensiones de WebKit. */
export interface VideoPip {
  requestPictureInPicture?: () => Promise<unknown>;
  disablePictureInPicture?: boolean;
  webkitSupportsPresentationMode?: (modo: string) => boolean;
  webkitSetPresentationMode?: (modo: string) => void;
  webkitPresentationMode?: string;
}

/** Lo que se usa del `document`. */
export interface DocumentoPip {
  pictureInPictureEnabled?: boolean;
  pictureInPictureElement?: unknown;
  exitPictureInPicture?: () => Promise<void>;
}

function estandar(video: VideoPip, doc: DocumentoPip): boolean {
  return (
    doc.pictureInPictureEnabled === true &&
    typeof video.requestPictureInPicture === "function" &&
    video.disablePictureInPicture !== true
  );
}

function deWebkit(video: VideoPip): boolean {
  return (
    typeof video.webkitSupportsPresentationMode === "function" &&
    typeof video.webkitSetPresentationMode === "function" &&
    video.webkitSupportsPresentationMode("picture-in-picture")
  );
}

/** ¿Este navegador sabe poner este vídeo en imagen en imagen? */
export function soportaImagenEnImagen(video: VideoPip | null, doc: DocumentoPip): boolean {
  if (!video) return false;
  return estandar(video, doc) || deWebkit(video);
}

/** ¿Está ahora mismo este vídeo en imagen en imagen? */
export function estaEnImagenEnImagen(video: VideoPip | null, doc: DocumentoPip): boolean {
  if (!video) return false;
  return doc.pictureInPictureElement === video || video.webkitPresentationMode === "picture-in-picture";
}

/**
 * Entra o sale. Tiene que llamarse desde el toque o el clic (el navegador
 * exige un gesto) y con el vídeo ya cargando: sin metadatos, la estándar
 * rechaza la petición.
 *
 * Si la estándar existe pero la rechaza y WebKit sabe hacerlo, se prueba la
 * de WebKit: en algunos iPhone las dos están y solo la segunda funciona.
 */
export async function alternarImagenEnImagen(video: VideoPip, doc: DocumentoPip): Promise<void> {
  if (estaEnImagenEnImagen(video, doc)) {
    if (doc.pictureInPictureElement === video && doc.exitPictureInPicture) await doc.exitPictureInPicture();
    else video.webkitSetPresentationMode?.("inline");
    return;
  }

  if (estandar(video, doc)) {
    try {
      await video.requestPictureInPicture?.();
      return;
    } catch (error) {
      if (!deWebkit(video)) throw error;
    }
  }

  if (deWebkit(video)) video.webkitSetPresentationMode?.("picture-in-picture");
}

/** Los eventos tras los que hay que volver a mirar soporte y estado. */
export const EVENTOS_PIP = [
  "enterpictureinpicture",
  "leavepictureinpicture",
  "webkitpresentationmodechanged",
  // El soporte de WebKit depende de lo cargado: se mira de nuevo al llegar.
  "loadedmetadata",
  "emptied",
] as const;
