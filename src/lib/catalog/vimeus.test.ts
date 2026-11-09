import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** La API de listados de Vimeus, con las respuestas reales medidas el 2026-11-09. */
vi.mock("next/cache", () => ({ cacheLife: () => {} }));
const config = { vimeusApiKey: "clave-de-prueba" };
vi.mock("@/lib/config.server", () => ({ serverConfig: () => config }));

const { entradasDe, episodiosDe, episodiosEnLatino, itemsDe, recienLlegadas } = await import("./vimeus");

const PELICULAS = {
  error: false,
  message: "Success",
  data: {
    result: [
      { tmdb_id: 1263337, title: "El corazón de la bestia", poster: "/kVD.jpg", backdrop: "/kpq.jpg", embed_url: "https://vimeus.net/e/movie?tmdb=1263337&view_key=x", quality: "FULL HD" },
      { tmdb_id: 1263337, title: "Repetida", poster: "/otra.jpg" },
      { tmdb_id: 5, title: "Sin póster", poster: null },
      { title: "Sin id", poster: "/x.jpg" },
    ],
    pages: 82,
  },
};

describe("formas de la respuesta", () => {
  it("lee `data.result` (la real) y `data.movies` (la de la documentación)", () => {
    expect(itemsDe(PELICULAS)).toHaveLength(4);
    expect(itemsDe({ data: { movies: [{ tmdb_id: 1 }] } })).toHaveLength(1);
    expect(itemsDe(null)).toEqual([]);
    expect(itemsDe({ data: "x" })).toEqual([]);
  });

  it("de la API a tarjetas: con póster de TMDB, sin repetidas ni incompletas", () => {
    const [una, ...resto] = entradasDe(PELICULAS, "movies");
    expect(resto).toEqual([]);
    expect(una).toMatchObject({
      tmdbId: 1263337,
      mediaType: "movie",
      title: "El corazón de la bestia",
      poster: "https://image.tmdb.org/t/p/w342/kVD.jpg",
      backdrop: "https://image.tmdb.org/t/p/w1280/kpq.jpg",
    });
    expect(entradasDe({ data: { result: [{ tmdb_id: 9, title: "S", poster: "/p.jpg" }] } }, "series")[0].mediaType).toBe("tv");
  });

  it("episodios de una temporada, aunque vengan como texto («1») y desordenados", () => {
    const datos = { data: { result: [{ season: "1", episode: "3" }, { season: "1", episode: "1" }, { season: "2", episode: "1" }, { season: "1", episode: "3" }] } };
    expect(episodiosDe(datos, 1)).toEqual([1, 3]);
  });
});

describe("llamadas a la API", () => {
  const fetchReal = globalThis.fetch;
  beforeEach(() => {
    config.vimeusApiKey = "clave-de-prueba";
  });
  afterEach(() => {
    globalThis.fetch = fetchReal;
  });

  it("manda la clave en X-API-Key y devuelve las recién llegadas", async () => {
    const llamada = vi.fn(async () => new Response(JSON.stringify(PELICULAS), { status: 200 }));
    globalThis.fetch = llamada as unknown as typeof fetch;
    const lista = await recienLlegadas("movies");
    expect(lista.map((e) => e.tmdbId)).toEqual([1263337]);
    const [url, init] = llamada.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://vimeus.net/api/listing/movies?page=1");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe("clave-de-prueba");
  });

  it("sin clave no llama a nadie y no rompe nada", async () => {
    config.vimeusApiKey = "";
    const llamada = vi.fn();
    globalThis.fetch = llamada as unknown as typeof fetch;
    expect(await recienLlegadas("series")).toEqual([]);
    expect(await episodiosEnLatino(1399, 1)).toBeNull();
    expect(llamada).not.toHaveBeenCalled();
  });

  it("404 en episodios es «ninguno»; un fallo de red es «no se sabe»", async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: true, message: "No content found" }), { status: 404 })) as unknown as typeof fetch;
    expect(await episodiosEnLatino(42, 1)).toEqual([]);
    globalThis.fetch = (async () => {
      throw new Error("sin red");
    }) as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await episodiosEnLatino(43, 1)).toBeNull();
  });
});
