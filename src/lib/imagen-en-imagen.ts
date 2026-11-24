/**
 * Imagen en imagen (PiP): el vídeo en una ventanita que flota sobre las demás
 * apps mientras se hace otra cosa.
 *
 * Hay dos vías y hacen falta las dos:
 *
 * - **La estándar** (`requestPictureInPicture`): Chrome, Edge, Android y
 *   Safari de Mac.
 * - **La de WebKit** (`webkitSetPresentationMode`): Safari de iPhone y iPad.
 *   Solo con la estándar, en el iPhone el botón no hacía nada.
 *
 * Antes el botón salía también donde no hay ninguna de las dos (Firefox, las
 * teles con Chromium viejo): un botón que no hace nada. Ahora solo sale si
 * alguna de las dos existe de verdad.
 *
 * **Salvo en la app instalada de iPhone y iPad.** Ahí iOS no da imagen en
 * imagen, aunque la misma página la tenga en Safari (fallo de WebKit 303885,
 * abierto). Y engaña: `pictureInPictureEnabled` dice que sí y la petición
 * falla después. Ver `pipVetadaPorIOS`.
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

/** Lo que hace falta saber del aparato para el caso de iOS. */
export interface AparatoPip {
  userAgent: string;
  maxTouchPoints: number;
  /** `navigator.standalone`: solo existe en iOS, `true` en la app instalada. */
  standalone?: boolean;
  /** `(display-mode: standalone)`: la app abierta desde su icono. */
  instalada: boolean;
}

/**
 * ¿Es la app instalada en la pantalla de inicio de un iPhone o un iPad? Ahí no
 * hay imagen en imagen: el botón no sirve, y al intentarlo (o al salir de la
 * app con un vídeo en pantalla completa) iOS lo rechaza y el vídeo se queda
 * en pausa. El iPad se presenta como un Mac, pero con pantalla táctil.
 */
export function pipVetadaPorIOS(aparato: AparatoPip): boolean {
  const esIOS =
    /iPhone|iPad|iPod/.test(aparato.userAgent) || (/Macintosh/.test(aparato.userAgent) && aparato.maxTouchPoints > 1);
  return esIOS && (aparato.standalone === true || aparato.instalada);
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
 * Con WebKit disponible (Safari) va primero por WebKit, y en el mismo turno
 * del toque. Antes se probaba la estándar y WebKit solo si aquella fallaba,
 * pero eso ya era después de un `await`: Safari daba el gesto por terminado y
 * rechazaba también la segunda.
 */
export async function alternarImagenEnImagen(video: VideoPip, doc: DocumentoPip): Promise<void> {
  if (estaEnImagenEnImagen(video, doc)) {
    if (doc.pictureInPictureElement === video && doc.exitPictureInPicture) await doc.exitPictureInPicture();
    else video.webkitSetPresentationMode?.("inline");
    return;
  }

  if (deWebkit(video)) {
    video.webkitSetPresentationMode?.("picture-in-picture");
    return;
  }

  if (estandar(video, doc)) await video.requestPictureInPicture?.();
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
