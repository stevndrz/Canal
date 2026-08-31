import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TOPES,
  cuantasRecordadas,
  olvidarDisponibilidad,
  servidoresConElTitulo,
} from "./disponibilidad";
import type { ServidorStream } from "@/lib/resolvers/types";

/** Un servidor como los que arma `servidoresEmbed`. */
function servidor(id: string, compruebaPorEstado = false): ServidorStream {
  return { id, label: id, url: `https://${id}.test/movie/1`, compruebaPorEstado };
}

/** Una respuesta con el estado pedido y un cuerpo que se pueda cancelar. */
function respuesta(status: number) {
  return { status, body: { cancel: async () => {} } } as unknown as Response;
}

afterEach(() => {
  olvidarDisponibilidad();
  vi.unstubAllGlobals();
});

describe("servidoresConElTitulo", () => {
  it("descarta al que responde 404: es Vimeus diciendo «no la tengo»", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(404)));
    const quedan = await servidoresConElTitulo([servidor("vimeus", true)]);
    expect(quedan).toEqual([]);
  });

  it("descarta al que responde 500: es Vidlink diciendo lo mismo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(500)));
    expect(await servidoresConElTitulo([servidor("vidlink", true)])).toEqual([]);
  });

  it("conserva al que responde 200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(200)));
    const quedan = await servidoresConElTitulo([servidor("vimeus", true)]);
    expect(quedan.map((s) => s.id)).toEqual(["vimeus"]);
  });

  it("**si la petición falla, el servidor se queda**", async () => {
    // A prueba de fallos abierta: un tiempo agotado o un bloqueo por IP no es
    // una respuesta sobre el título. Esconder un servidor por un error de red
    // sería peor que el problema que esto arregla.
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("TimeoutError");
    }));
    expect((await servidoresConElTitulo([servidor("vimeus", true)])).length).toBe(1);
  });

  it("un 403 de Cloudflare NO descarta: habla de quien pregunta, no del título", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(403)));
    expect((await servidoresConElTitulo([servidor("multiembed", true)])).length).toBe(1);
  });

  it("a los proveedores sin señal comprobada ni se les pregunta", async () => {
    // Videasy y VidSrc devuelven 200 tengan o no el título: preguntarles sería
    // gastar una petición por ficha para no aprender nada.
    const espia = vi.fn(async () => respuesta(404));
    vi.stubGlobal("fetch", espia);
    const quedan = await servidoresConElTitulo([servidor("videasy"), servidor("vidsrc")]);
    expect(quedan).toHaveLength(2);
    expect(espia).not.toHaveBeenCalled();
  });

  it("no vuelve a preguntar lo que ya sabe", async () => {
    const espia = vi.fn(async () => respuesta(404));
    vi.stubGlobal("fetch", espia);
    await servidoresConElTitulo([servidor("vimeus", true)]);
    await servidoresConElTitulo([servidor("vimeus", true)]);
    expect(espia).toHaveBeenCalledTimes(1);
  });

  it("cada título se pregunta por separado", async () => {
    const espia = vi.fn(async () => respuesta(200));
    vi.stubGlobal("fetch", espia);
    await servidoresConElTitulo([
      { id: "vimeus", label: "1", url: "https://vimeus.test/movie/1", compruebaPorEstado: true },
      { id: "vimeus", label: "1", url: "https://vimeus.test/movie/2", compruebaPorEstado: true },
    ]);
    expect(espia).toHaveBeenCalledTimes(2);
  });

  it("conserva el orden de los que sobreviven", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      respuesta(String(url).includes("vimeus") ? 404 : 200)));
    const quedan = await servidoresConElTitulo([
      servidor("vimeus", true),
      servidor("vidsrc"),
      servidor("vidlink", true),
    ]);
    expect(quedan.map((s) => s.id)).toEqual(["vidsrc", "vidlink"]);
  });
});

describe("la memoria no se puede vaciar desde fuera", () => {
  /** Una consulta a un título distinto cada vez, como haría quien barre ids. */
  async function preguntarPor(n: number) {
    await servidoresConElTitulo([
      { id: "vimeus", label: "1", url: `https://vimeus.test/movie/${n}`, compruebaPorEstado: true },
    ]);
  }

  it("desaloja lo menos usado en vez de tirarlo todo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(200)));

    // Un título que se está viendo: se pregunta al principio y se sigue
    // consultando mientras alguien barre ids inventados.
    await preguntarPor(0);
    for (let i = 1; i <= TOPES.MAX_ENTRADAS + TOPES.A_TIRAR; i++) {
      await preguntarPor(i);
      if (i % 100 === 0) await preguntarPor(0);
    }

    // Antes esto vaciaba el mapa entero y el título caliente volvía a
    // preguntarse a los proveedores. Ahora sigue dentro.
    expect(cuantasRecordadas()).toBeLessThanOrEqual(TOPES.MAX_ENTRADAS);
    const llamadasPrevias = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await preguntarPor(0);
    expect(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
      "el título consultado a menudo no debería volver a preguntarse",
    ).toBe(llamadasPrevias);
  });

  it("nunca pasa del tope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respuesta(200)));
    for (let i = 0; i < TOPES.MAX_ENTRADAS * 2; i++) await preguntarPor(i);
    expect(cuantasRecordadas()).toBeLessThanOrEqual(TOPES.MAX_ENTRADAS);
  });
});
