import { describe, expect, it, vi } from "vitest";
import {
  alternarImagenEnImagen,
  estaEnImagenEnImagen,
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

  it("si la estándar la rechaza y WebKit sabe, prueba con WebKit", async () => {
    const video = {
      ...videoWebkit(),
      requestPictureInPicture: vi.fn(async () => {
        throw new Error("NotSupportedError");
      }),
    };
    await alternarImagenEnImagen(video, { pictureInPictureEnabled: true });
    expect(video.webkitSetPresentationMode).toHaveBeenCalledWith("picture-in-picture");
  });

  it("si no hay otra vía, el rechazo sube a quien llamó", async () => {
    const video: VideoPip = {
      requestPictureInPicture: async () => {
        throw new Error("NotAllowedError");
      },
    };
    await expect(alternarImagenEnImagen(video, { pictureInPictureEnabled: true })).rejects.toThrow("NotAllowedError");
  });
});
