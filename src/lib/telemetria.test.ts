import { describe, expect, it } from "vitest";
import {
  formatearBitrate,
  modulosDeEmision,
  nombreDeResolucion,
  palabraDeEstado,
  tiempoEnCanal,
} from "./telemetria";

describe("nombreDeResolucion", () => {
  it("clasifica por ALTURA, no por ancho", () => {
    // Muchos canales emiten 4:3 dentro de un contenedor 16:9. Por ancho,
    // 1440×1080 saldría como 720p y es 1080p de verdad.
    expect(nombreDeResolucion(1440, 1080)).toBe("1080p");
    expect(nombreDeResolucion(1920, 1080)).toBe("1080p");
    expect(nombreDeResolucion(640, 480)).toBe("480p");
    expect(nombreDeResolucion(3840, 2160)).toBe("4K");
  });

  it("una altura rara se dice tal cual, no se redondea a otra cosa", () => {
    expect(nombreDeResolucion(426, 240)).toBe("240p");
  });

  it("sin medida, no hay nombre", () => {
    expect(nombreDeResolucion(undefined, undefined)).toBeNull();
    expect(nombreDeResolucion(1920, 0)).toBeNull();
  });
});

describe("formatearBitrate", () => {
  it("un decimal por debajo de 10 Mb/s", () => {
    expect(formatearBitrate(4_200_000)).toBe("4,2 Mb/s");
  });

  it("ninguno por encima: un dígito que no para de cambiar distrae", () => {
    expect(formatearBitrate(12_400_000)).toBe("12 Mb/s");
  });

  it("por debajo de 1 Mb/s se dice en kb/s", () => {
    expect(formatearBitrate(640_000)).toBe("640 kb/s");
  });

  it("**sin dato no se inventa nada**", () => {
    expect(formatearBitrate(undefined)).toBeNull();
    expect(formatearBitrate(0)).toBeNull();
  });
});

describe("tiempoEnCanal", () => {
  it("minutos y segundos mientras no haya horas", () => {
    expect(tiempoEnCanal(0, 74_000)).toBe("01:14");
  });

  it("horas solo cuando las hay", () => {
    expect(tiempoEnCanal(0, 3_725_000)).toBe("1:02:05");
  });

  it("un reloj que va hacia atrás no da negativos", () => {
    expect(tiempoEnCanal(5_000, 0)).toBe("00:00");
  });
});

describe("modulosDeEmision", () => {
  it("**un módulo sin dato no existe**", () => {
    // Con mpegts.js o con el HLS nativo de Safari no hay bitrate que leer. Un
    // hueco con un guion parece un fallo; no enseñarlo, no.
    const modulos = modulosDeEmision({ ancho: 1920, alto: 1080 });
    expect(modulos.map((m) => m.etiqueta)).toEqual(["Señal"]);
  });

  it("con todo, los tres en orden", () => {
    const modulos = modulosDeEmision({
      ancho: 1920, alto: 1080, bitrate: 4_200_000, desde: 0, ahora: 74_000,
    });
    expect(modulos).toEqual([
      { etiqueta: "Señal", valor: "1080p" },
      { etiqueta: "Tasa", valor: "4,2 Mb/s" },
      { etiqueta: "En canal", valor: "T+ 01:14" },
    ]);
  });

  it("sin nada que decir, ni un módulo", () => {
    expect(modulosDeEmision({})).toEqual([]);
  });
});

describe("palabraDeEstado", () => {
  it("dice el estado con palabras, no con un icono", () => {
    // Un icono solo funciona para quien ya lo conoce; a tres metros y sin
    // manual, la palabra siempre gana.
    expect(palabraDeEstado("vivo")).toBe("EN VIVO");
    expect(palabraDeEstado("sin-senal")).toBe("SIN SEÑAL");
    expect(palabraDeEstado("pausa")).toBe("PAUSA");
    expect(palabraDeEstado("emitiendo")).toBe("EMITIENDO");
    expect(palabraDeEstado("sintonizando")).toBe("SINTONIZANDO");
  });
});
