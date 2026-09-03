import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { salirDeLaApp } from "./salir-de-la-app";

const global = globalThis as unknown as Record<string, unknown>;

/**
 * Estas pruebas corren en Node, donde `window` no existe (ver
 * `vitest.config.ts`). Se apunta `window` a `globalThis` para poder colgar de
 * él los objetos que inyecta cada televisor; el caso «no hay navegador» tiene
 * su propia prueba, que lo quita.
 */
beforeEach(() => {
  global.window = globalThis;
});

afterEach(() => {
  delete global.tizen;
  delete global.webOS;
  delete global.CanalCasaAndroid;
  delete global.window;
});

describe("salirDeLaApp", () => {
  it("en un navegador corriente no cierra nada y lo dice", () => {
    expect(salirDeLaApp()).toBe(false);
  });

  it("en el servidor tampoco intenta nada", () => {
    delete global.window;
    expect(salirDeLaApp()).toBe(false);
  });

  it("en Tizen llama al exit de la aplicación", () => {
    const exit = vi.fn();
    global.tizen = { application: { getCurrentApplication: () => ({ exit }) } };
    expect(salirDeLaApp()).toBe(true);
    expect(exit).toHaveBeenCalledOnce();
  });

  it("en webOS usa platformBack", () => {
    const platformBack = vi.fn();
    global.webOS = { platformBack };
    expect(salirDeLaApp()).toBe(true);
    expect(platformBack).toHaveBeenCalledOnce();
  });

  it("en la cáscara de Android TV usa el puente de la Activity", () => {
    const salir = vi.fn();
    global.CanalCasaAndroid = { salir };
    expect(salirDeLaApp()).toBe(true);
    expect(salir).toHaveBeenCalledOnce();
  });

  it("si Tizen está a medias, sigue probando en vez de reventar", () => {
    // Pasa de verdad: el objeto `tizen` existe sin el privilegio declarado y
    // `getCurrentApplication` lanza. Sin el try/catch, Atrás dejaría de
    // funcionar del todo en la pantalla de inicio.
    const platformBack = vi.fn();
    global.tizen = {
      application: {
        getCurrentApplication: () => {
          throw new Error("sin privilegio");
        },
      },
    };
    global.webOS = { platformBack };
    expect(salirDeLaApp()).toBe(true);
    expect(platformBack).toHaveBeenCalledOnce();
  });
});
