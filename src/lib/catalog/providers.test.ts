import { describe, expect, it } from "vitest";
import { buildEmbedUrl, getProviders, ordenarParaTelevisor } from "./providers";

/** Los proveedores que de verdad cubren un tipo, en el orden en que se usan. */
function paraTipo(tipo: "movie" | "tv") {
  return getProviders().filter((provider) =>
    buildEmbedUrl(provider, tipo, { tmdbId: 123192, season: 1, episode: 1 }),
  );
}

/**
 * El orden de los proveedores ES el producto: decide qué se ve al abrir una
 * ficha, antes de que nadie toque un botón. Lo decidió el dueño el
 * 2026-10-08: Vimeus (latino) primero y Vidzee de recaída, que es el que de
 * verdad le reproduce en el teléfono. Ver el comentario de `EMBED_PROVIDERS`.
 */
describe("orden de los proveedores", () => {
  it("en PELÍCULAS manda Vimeus: es el del doblaje latino", () => {
    expect(paraTipo("movie")[0].id).toBe("vimeus");
  });

  it("la recaída es Vidzee, justo detrás", () => {
    expect(paraTipo("movie")[1].id).toBe("vidzee");
  });

  it("en SERIES también manda Vimeus (latino), con su ruta de series y la de anime detrás", () => {
    // Desde el 2026-11-09 (cuenta propia, vimeus.net) Vimeus tiene series. De
    // las dos rutas, la comprobación por estado deja solo la que corresponde.
    expect(paraTipo("tv").map((p) => p.id).slice(0, 3)).toEqual(["vimeus", "vimeus-anime", "vidzee"]);
  });

  it("las URLs de Vimeus van a vimeus.net, con temporada, episodio y la view key", () => {
    const [vimeus, anime] = getProviders();
    expect(buildEmbedUrl(vimeus, "movie", { tmdbId: 550 })).toMatch(/^https:\/\/vimeus\.net\/e\/movie\?tmdb=550&view_key=[\w-]+&autoplay=1$/);
    expect(buildEmbedUrl(vimeus, "tv", { tmdbId: 1399, season: 2, episode: 5 })).toMatch(
      /^https:\/\/vimeus\.net\/e\/serie\?tmdb=1399&se=2&ep=5&view_key=/,
    );
    expect(buildEmbedUrl(anime, "tv", { tmdbId: 225180, season: 1, episode: 3 })).toMatch(/\/e\/anime\?tmdb=225180&se=1&ep=3&/);
    // El anime de película va por /e/movie, como cualquier película.
    expect(buildEmbedUrl(anime, "movie", { tmdbId: 372058 })).toBeNull();
  });

  it("los de Vimeus llevan la marca «Latino» y se comprueban antes de enseñarse", () => {
    for (const p of getProviders().slice(0, 2)) {
      expect(p.latino).toBe(true);
      expect(p.compruebaPorEstado).toBe(true);
    }
  });

  it("todos siguen ahí, en el orden acordado, y los muertos ya no", () => {
    expect(getProviders().map((p) => p.id)).toEqual(["vimeus", "vimeus-anime", "vidzee", "multiembed", "vidrock"]);
  });

  it("nadie se anuncia con subtítulos en español: hoy ninguno los trae comprobados", () => {
    // La etiqueta es una promesa en el botón. El único que los traía era
    // VidSrc, y su dominio murió.
    expect(getProviders().filter((p) => p.spanishSubtitles)).toEqual([]);
  });

  it("en la tele, el de la puerta antirrobot va al final y el latino sigue primero", () => {
    // Una puerta de Cloudflare no pasa en un televisor y el marco se recarga
    // sin fin; ver `ordenarParaTelevisor`.
    expect(ordenarParaTelevisor(paraTipo("movie")).map((p) => p.id)).toEqual([
      "vimeus",
      "vidzee",
      "vidrock",
      "multiembed",
    ]);
  });

  it("los nuevos cubren películas y series", () => {
    for (const id of ["vidzee", "vidrock"]) {
      expect(paraTipo("movie").map((p) => p.id)).toContain(id);
      expect(paraTipo("tv").map((p) => p.id)).toContain(id);
    }
  });

  it("`getProviders` numera sobre la lista COMPLETA, no por tipo", () => {
    // Documenta el reparto: «vimeus-anime» no cubre películas y aun así se
    // numera, y por eso `/api/stream` renumera después de filtrar y el
    // respaldo de la ficha se llama «Servidor 1» a mano.
    expect(getProviders().map((p) => p.label)).toEqual([
      "Servidor 1",
      "Servidor 2",
      "Servidor 3",
      "Servidor 4",
      "Servidor 5",
    ]);
    expect(paraTipo("movie")[1].label).toBe("Servidor 3");
  });
});
