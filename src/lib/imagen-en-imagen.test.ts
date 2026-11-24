import { describe, expect, it, vi } from "vitest";
import {
  alternarImagenEnImagen,
  estaEnImagenEnImagen,
  pipVetadaPorIOS,
  soportaImagenEnImagen,
  type DocumentoPip,
  type VideoPip,
} from "./imagen-en-imagen";

function videoEstandar(): VideoPip {
  return { requestPictureInPicture: vi.fn(async () => undefined) };
}

function videoWebkit(modo = "inline"): VideoPip & { webkitPresentationMode: string } {
  const video = {
    webkitPresentationMode: modo,
    webkitSupportsPresentationMode: (m: string) => m === "picture-in-picture",
    webkitSetPresentationMode: vi.fn((m: string) => {
      video.webkitPresentationMode = m;
    }),
  };
  return video;
}

describe("soportaImagenEnImagen", () => {
  it("la estándar cuenta solo si el documento la deja usar", () => {
    expect(soportaImagenEnImagen(videoEstandar(), { pictureInPictureEnabled: true })).toBe(true);
    expect(soportaImagenEnImagen(videoEstandar(), { pictureInPictureEnabled: false })).toBe(false);
  });

  it("el iPhone entra por la vía de WebKit", () => {
    expect(soportaImagenEnImagen(videoWebkit(), {})).toBe(true);
  });

  it("sin ninguna de las dos no hay botón (Firefox, teles viejas)", () => {
    // Antes el botón salía si el documento no traía `pictureInPictureEnabled`.
    expect(soportaImagenEnImagen({}, {})).toBe(false);
    expect(soportaImagenEnImagen(null, { pictureInPictureEnabled: true })).toBe(false);
  });

  it("respeta disablePictureInPicture", () => {
    const video = { ...videoEstandar(), disablePictureInPicture: true };
    expect(soportaImagenEnImagen(video, { pictureInPictureEnabled: true })).toBe(false);
  });
});

describe("alternarImagenEnImagen", () => {
  it("entra con la estándar cuando la hay", async () => {
    const video = videoEstandar();
    await alternarImagenEnImagen(video, { pictureInPictureEnabled: true });
    expect(video.requestPictureInPicture).toHaveBeenCalledOnce();
  });

  it("sale con la estándar si este vídeo es el que flota", async () => {
    const video = videoEstandar();
    const doc: DocumentoPip = {
      pictureInPictureEnabled: true,
      pictureInPictureElement: video,
      exitPictureInPicture: vi.fn(async () => undefined),
    };
    expect(estaEnImagenEnImagen(video, doc)).toBe(true);
    await alternarImagenEnImagen(video, doc);
    expect(doc.exitPictureInPicture).toHaveBeenCalledOnce();
    expect(video.requestPictureInPicture).not.toHaveBeenCalled();
  });

  it("en el iPhone entra y sale por WebKit", async () => {
    const video = videoWebkit();
    await alternarImagenEnImagen(video, {});
    expect(video.webkitPresentationMode).toBe("picture-in-picture");
    expect(estaEnImagenEnImagen(video, {})).toBe(true);
    await alternarImagenEnImagen(video, {});
    expect(video.webkitPresentationMode).toBe("inline");
  });

  it("con las dos (Safari), va por WebKit y sin esperar: así no pierde el gesto", async () => {
    const video = { ...videoWebkit(), requestPictureInPicture: vi.fn(async () => undefined) };
    const promesa = alternarImagenEnImagen(video, { pictureInPictureEnabled: true });
    // Ya puesta antes de resolver nada: en el mismo turno del toque.
    expect(video.webkitSetPresentationMode).toHaveBeenCalledWith("picture-in-picture");
    await promesa;
    expect(video.requestPictureInPicture).not.toHaveBeenCalled();
  });

  it("si la estándar la rechaza, el rechazo sube a quien llamó", async () => {
    const video: VideoPip = {
      requestPictureInPicture: async () => {
        throw new Error("NotAllowedError");
      },
    };
    await expect(alternarImagenEnImagen(video, { pictureInPictureEnabled: true })).rejects.toThrow("NotAllowedError");
  });
});

describe("pipVetadaPorIOS", () => {
  const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
  const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15";
  const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

  it("la app instalada de iPhone no tiene imagen en imagen", () => {
    expect(pipVetadaPorIOS({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true, instalada: true })).toBe(true);
  });

  it("el mismo iPhone en Safari sí", () => {
    expect(pipVetadaPorIOS({ userAgent: IPHONE, maxTouchPoints: 5, standalone: false, instalada: false })).toBe(false);
  });

  it("el iPad instalado también, aunque se presente como un Mac", () => {
    expect(pipVetadaPorIOS({ userAgent: IPAD, maxTouchPoints: 5, instalada: true })).toBe(true);
    // Un Mac de verdad no tiene pantalla táctil.
    expect(pipVetadaPorIOS({ userAgent: IPAD, maxTouchPoints: 0, instalada: true })).toBe(false);
  });

  it("Android instalado sí la tiene", () => {
    expect(pipVetadaPorIOS({ userAgent: ANDROID, maxTouchPoints: 5, instalada: true })).toBe(false);
  });
});
