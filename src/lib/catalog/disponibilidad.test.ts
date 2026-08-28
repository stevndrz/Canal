import { afterEach, describe, expect, it, vi } from "vitest";
import { olvidarDisponibilidad, servidoresConElTitulo } from "./disponibilidad";
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
