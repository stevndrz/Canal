import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { girarAHorizontal, puedeGirar, soltarOrientacion } from "./orientacion";

/**
 * Las pruebas corren en Node (ver `vitest.config.ts`): se monta a mano un
 * navegador mínimo con lo único que miran las guardas. Por defecto es el caso
 * que SÍ gira —un Android en la mano, con la pantalla completa ya concedida—,
 * y cada prueba rompe una sola condición para ver que basta para no girar.
 */
const UA_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const UA_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const UA_TIZEN =
  "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36";

let lock: ReturnType<typeof vi.fn>;
let unlock: ReturnType<typeof vi.fn>;
let entorno: {
  ua: string;
  tosco: boolean;
  ancho: number;
  alto: number;
  pantalla?: string;
  enPantallaCompleta: boolean;
};

beforeEach(() => {
  lock = vi.fn(() => Promise.resolve());
  unlock = vi.fn();
  entorno = { ua: UA_ANDROID, tosco: true, ancho: 412, alto: 915, enPantallaCompleta: true };
  vi.stubGlobal("window", {
    matchMedia: (consulta: string) => ({ matches: consulta === "(pointer: coarse)" && entorno.tosco }),
  });
  vi.stubGlobal("navigator", {
    get userAgent() {
      return entorno.ua;
    },
  });
  vi.stubGlobal("screen", {
    get width() {
      return entorno.ancho;
    },
    get height() {
      return entorno.alto;
    },
    orientation: { lock, unlock },
  });
  vi.stubGlobal("document", {
    get fullscreenElement() {
      return entorno.enPantallaCompleta ? {} : null;
    },
    documentElement: {
      get dataset() {
        return entorno.pantalla ? { pantalla: entorno.pantalla } : {};
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("puedeGirar", () => {
  it("gira un Android en la mano con la pantalla completa concedida", () => {
    expect(puedeGirar()).toBe(true);
  });

  it("no gira un iPhone: su reproductor del sistema ya gira solo", () => {
    entorno.ua = UA_IPHONE;
    expect(puedeGirar()).toBe(false);
  });

  it("no gira un televisor, ni por su UA ni por data-pantalla", () => {
    entorno.ua = UA_TIZEN;
    expect(puedeGirar()).toBe(false);
    entorno.ua = UA_ANDROID;
    entorno.pantalla = "tv";
    expect(puedeGirar()).toBe(false);
  });

  it("no gira con ratón: un monitor no gira", () => {
    entorno.tosco = false;
    expect(puedeGirar()).toBe(false);
  });

  it("no gira una tableta: decide quien la sostiene", () => {
    entorno.ancho = 800;
    entorno.alto = 1280;
    expect(puedeGirar()).toBe(false);
  });

  it("no gira sin pantalla completa: Chrome rechazaría el bloqueo", () => {
    entorno.enPantallaCompleta = false;
    expect(puedeGirar()).toBe(false);
  });

  it("no gira si el navegador no sabe bloquear", () => {
    vi.stubGlobal("screen", { width: 412, height: 915, orientation: {} });
    expect(puedeGirar()).toBe(false);
  });

  it("en el servidor no hay nada que girar", () => {
    vi.stubGlobal("window", undefined);
    expect(puedeGirar()).toBe(false);
  });
});

describe("girarAHorizontal", () => {
  it("pide horizontal cuando puede", async () => {
    await girarAHorizontal();
    expect(lock).toHaveBeenCalledWith("landscape");
  });

  it("no pide nada en un iPhone", async () => {
    entorno.ua = UA_IPHONE;
    await girarAHorizontal();
    expect(lock).not.toHaveBeenCalled();
  });

  it("se traga el rechazo: la pantalla completa ya conseguida no se pierde", async () => {
    lock.mockImplementation(() => Promise.reject(new DOMException("no", "NotSupportedError")));
    await expect(girarAHorizontal()).resolves.toBeUndefined();
  });
});

describe("soltarOrientacion", () => {
  it("devuelve la orientación al sistema", () => {
    soltarOrientacion();
    expect(unlock).toHaveBeenCalledOnce();
  });

  it("no lanza si no hay nada que soltar", () => {
    unlock.mockImplementation(() => {
      throw new Error("sin bloqueo");
    });
    expect(() => soltarOrientacion()).not.toThrow();
    vi.stubGlobal("screen", {});
    expect(() => soltarOrientacion()).not.toThrow();
  });
});
