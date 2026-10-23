import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La frontera de `/api/salud`: solo sale a URLs de la lista de canales.
 *
 * Sin red: la lista y el `fetch` se sustituyen, y lo que se mira es si la ruta
 * llega a salir o no.
 */
vi.mock("@/lib/m3u", () => ({
  loadM3uPlaylist: async () => ({
    channels: [
      {
        streamUrl: "https://emisor.example/canal7.m3u8",
        streamUrlBackup: "https://respaldo.example/canal7.m3u8",
      },
    ],
    epgUrl: null,
  }),
}));

const { GET } = await import("./route");
const { olvidarTodo } = await import("@/lib/limite-peticiones");

function pedir(url: string): Request {
  return new Request(`http://localhost/api/salud?url=${encodeURIComponent(url)}`);
}

describe("/api/salud", () => {
  const salida = vi.fn(async () => new Response("#EXTM3U\n", { status: 200 }));

  beforeEach(() => {
    olvidarTodo();
    salida.mockClear();
    vi.stubGlobal("fetch", salida);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("no sale a una URL que no está en la lista", async () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://192.168.1.1/",
      "https://cualquiera.example/",
    ]) {
      const respuesta = await GET(pedir(url));
      expect(respuesta.status).toBe(403);
    }
    expect(salida).not.toHaveBeenCalled();
  });

  it("sondea la principal y el respaldo de un canal", async () => {
    for (const url of [
      "https://emisor.example/canal7.m3u8",
      "https://respaldo.example/canal7.m3u8",
    ]) {
      const respuesta = await GET(pedir(url));
      expect(respuesta.status).toBe(200);
      expect((await respuesta.json()).esM3u8).toBe(true);
    }
    expect(salida).toHaveBeenCalledTimes(2);
  });

  it("sigue rechazando lo que no es http(s)", async () => {
    const respuesta = await GET(pedir("file:///etc/passwd"));
    expect(respuesta.status).toBe(400);
    expect(salida).not.toHaveBeenCalled();
  });
});
