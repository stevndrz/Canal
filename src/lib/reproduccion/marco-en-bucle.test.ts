import { describe, expect, it } from "vitest";
import {
  CARGAS_ANTES_DE_RENDIRSE,
  VENTANA_BUCLE_MS,
  registrarCarga,
  type ConteoDeCargas,
} from "./marco-en-bucle";

/** Encadena varias cargas seguidas, separadas por `pasoMs`. */
function cargarVeces(veces: number, servidorId = "vidsrc", pasoMs = 700) {
  let conteo: ConteoDeCargas | null = null;
  let enBucle = false;
  for (let i = 0; i < veces; i++) {
    const veredicto = registrarCarga(conteo, servidorId, 1_000 + i * pasoMs);
    conteo = veredicto.conteo;
    enBucle = veredicto.enBucle;
  }
  return { conteo, enBucle };
}

describe("registrarCarga", () => {
  it("una carga normal no es un bucle", () => {
    expect(cargarVeces(1).enBucle).toBe(false);
  });

  it("tolera las redirecciones legítimas: Turnstile navega una vez cuando SÍ pasa", () => {
    expect(cargarVeces(2).enBucle).toBe(false);
    expect(cargarVeces(CARGAS_ANTES_DE_RENDIRSE).enBucle).toBe(false);
  });

  it("a la cuarta seguida se rinde", () => {
    expect(cargarVeces(CARGAS_ANTES_DE_RENDIRSE + 1).enBucle).toBe(true);
  });

  it("reproduce el caso medido: 8 recargas en 5 segundos son un bucle", () => {
    expect(cargarVeces(8, "vidsrc", 625).enBucle).toBe(true);
  });

  it("cambiar de servidor reinicia el conteo: el nuevo merece su propia oportunidad", () => {
    const { conteo } = cargarVeces(CARGAS_ANTES_DE_RENDIRSE + 1);
    const veredicto = registrarCarga(conteo, "videasy", 5_000);
    expect(veredicto.enBucle).toBe(false);
    expect(veredicto.conteo).toEqual({ servidorId: "videasy", veces: 1, desde: 5_000 });
  });

  it("cargas espaciadas NO son un bucle: es alguien navegando dentro del embed", () => {
    let conteo: ConteoDeCargas | null = null;
    let enBucle = false;
    // Una carga cada VENTANA+1: nunca deberían acumularse.
    for (let i = 0; i < 10; i++) {
      const veredicto = registrarCarga(conteo, "vidsrc", i * (VENTANA_BUCLE_MS + 1));
      conteo = veredicto.conteo;
      enBucle = veredicto.enBucle;
    }
    expect(enBucle).toBe(false);
    expect(conteo?.veces).toBe(1);
  });

  it("la ventana se mide desde la PRIMERA carga, no desde la anterior", () => {
    // Cuatro cargas repartidas justo dentro de la ventana: sigue siendo bucle.
    const paso = Math.floor(VENTANA_BUCLE_MS / 4);
    expect(cargarVeces(CARGAS_ANTES_DE_RENDIRSE + 1, "vidsrc", paso).enBucle).toBe(true);
    // Las mismas cuatro, pero desbordando la ventana: ya no.
    expect(cargarVeces(CARGAS_ANTES_DE_RENDIRSE + 1, "vidsrc", VENTANA_BUCLE_MS).enBucle).toBe(
      false,
    );
  });
});
