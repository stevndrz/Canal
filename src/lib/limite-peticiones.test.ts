import { beforeEach, describe, expect, it } from "vitest";
import {
  LIMITES,
  excedeLimite,
  identificarCliente,
  olvidarTodo,
  respuestaLimite,
} from "./limite-peticiones";

beforeEach(() => olvidarTodo());

describe("identificarCliente", () => {
  it("se queda con la PRIMERA IP de `x-forwarded-for`", () => {
    // En Vercel el proxy reescribe la cabecera, así que la primera es la real;
    // las de después las pudo añadir quien llama.
    const peticion = new Request("https://x.test", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" },
    });
    expect(identificarCliente(peticion)).toBe("203.0.113.7");
  });

  it("cae a `x-real-ip` y luego a un agrupador único", () => {
    expect(
      identificarCliente(new Request("https://x.test", { headers: { "x-real-ip": "198.51.100.4" } })),
    ).toBe("198.51.100.4");
    expect(identificarCliente(new Request("https://x.test"))).toBe("desconocido");
  });
});

describe("excedeLimite", () => {
  it("deja pasar hasta el cupo y corta al siguiente", () => {
    for (let i = 0; i < LIMITES.PETICIONES; i++) {
      expect(excedeLimite("ip", 1_000), `petición ${i + 1}`).toBe(false);
    }
    expect(excedeLimite("ip", 1_000)).toBe(true);
  });

  it("la ventana se renueva: pasado el minuto se vuelve a empezar", () => {
    for (let i = 0; i <= LIMITES.PETICIONES; i++) excedeLimite("ip", 1_000);
    expect(excedeLimite("ip", 1_000)).toBe(true);
    expect(excedeLimite("ip", 1_000 + LIMITES.VENTANA_MS + 1)).toBe(false);
  });

  it("cada IP lleva su propia cuenta", () => {
    for (let i = 0; i <= LIMITES.PETICIONES; i++) excedeLimite("uno", 1_000);
    expect(excedeLimite("uno", 1_000)).toBe(true);
    expect(excedeLimite("otro", 1_000)).toBe(false);
  });

  it("el propio Map no puede crecer sin fin: es el agujero obvio de esto", () => {
    // Falsificar `x-forwarded-for` en cada petición haría crecer el Map hasta
    // agotar la memoria de la función. Al pasarse del tope se vacía entero.
    for (let i = 0; i < LIMITES.MAX_IPS + 10; i++) excedeLimite(`ip-${i}`, 1_000);
    // Tras el vaciado, una IP que ya se había pasado vuelve a entrar limpia:
    // perder el conteo un instante es mejor que caerse.
    for (let i = 0; i <= LIMITES.PETICIONES; i++) excedeLimite("machacona", 1_000);
    expect(excedeLimite("machacona", 1_000)).toBe(true);
  });
});

describe("respuestaLimite", () => {
  it("responde 429 con `Retry-After` y sin cachear", () => {
    const respuesta = respuestaLimite();
    expect(respuesta.status).toBe(429);
    expect(respuesta.headers.get("Retry-After")).toBe(String(LIMITES.VENTANA_MS / 1000));
    // Cachear un 429 dejaría a media red bloqueada por culpa de uno.
    expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("identificarCliente: de menos falsificable a más", () => {
  it("la cabecera de Vercel gana a un `x-forwarded-for` inventado", () => {
    // Quien llama puede escribir lo que quiera en `x-forwarded-for`; la red de
    // Vercel descarta lo que traiga y pone la suya.
    const peticion = new Request("https://x.test", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.7",
        "x-forwarded-for": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
      },
    });
    expect(identificarCliente(peticion)).toBe("203.0.113.7");
  });

  it("`x-real-ip` gana a `x-forwarded-for`: no admite lista donde colarse", () => {
    const peticion = new Request("https://x.test", {
      headers: { "x-real-ip": "198.51.100.4", "x-forwarded-for": "1.1.1.1" },
    });
    expect(identificarCliente(peticion)).toBe("198.51.100.4");
  });
});

describe("tope global", () => {
  it("una IP distinta en cada petición ya no sale gratis", () => {
    // El ataque que el cupo por IP no cubre: falsificar la cabecera estrena
    // ventana cada vez. Esto es lo único que sigue en pie ahí.
    let cortadas = 0;
    for (let i = 0; i < LIMITES.TOPE_GLOBAL + 50; i++) {
      if (excedeLimite(`falsa-${i}`, 1_000)) cortadas += 1;
    }
    expect(cortadas).toBeGreaterThan(0);
  });

  it("cuenta también lo que el cupo por IP ya iba a rechazar", () => {
    // Si solo contara lo que pasa, machacar desde una sola IP saldría gratis.
    for (let i = 0; i < LIMITES.TOPE_GLOBAL + 5; i++) excedeLimite("una sola", 1_000);
    expect(excedeLimite("recién llegada", 1_000)).toBe(true);
  });

  it("se renueva con la ventana, igual que el cupo por IP", () => {
    for (let i = 0; i < LIMITES.TOPE_GLOBAL + 5; i++) excedeLimite("una sola", 1_000);
    expect(excedeLimite("recién llegada", 1_000)).toBe(true);
    expect(excedeLimite("recién llegada", 1_000 + LIMITES.VENTANA_MS + 1)).toBe(false);
  });

  it("va holgado: una casa entera no lo roza", () => {
    // Cinco aparatos a pleno cupo siguen pasando; el tope solo salta con un
    // volumen que ninguna casa produce.
    expect(LIMITES.TOPE_GLOBAL).toBeGreaterThanOrEqual(LIMITES.PETICIONES * 5);
  });
});
