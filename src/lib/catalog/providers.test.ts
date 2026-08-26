import { describe, expect, it } from "vitest";
import { buildEmbedUrl, getProviders } from "./providers";

/** Los proveedores que de verdad cubren un tipo, en el orden en que se usan. */
function paraTipo(tipo: "movie" | "tv") {
  return getProviders().filter((provider) =>
    buildEmbedUrl(provider, tipo, { tmdbId: 123192, season: 1, episode: 1 }),
  );
}

/**
 * El orden de los proveedores ES el producto: decide qué se ve al abrir una
 * ficha, antes de que nadie toque un botón. Se fija aquí porque es una
 * decisión tomada a conciencia —subtítulos por delante de comodidad— y no algo
 * que deba moverse sin querer.
 */
describe("orden de los proveedores", () => {
  it("en PELÍCULAS manda Vimeus: es el del doblaje latino", () => {
    expect(paraTipo("movie")[0].id).toBe("vimeus");
  });

  it("en SERIES manda VidSrc, porque Vimeus no las cubre", () => {
    // La ruta de series de Vimeus responde 404, así que ni aparece.
    expect(paraTipo("tv").map((p) => p.id)).not.toContain("vimeus");
    expect(paraTipo("tv")[0].id).toBe("vidsrc");
  });

  it("VidSrc va delante de los demás embeds: es el único con subtítulos", () => {
    // Vidlink solo pinta los subtítulos que se le pasen en `sub_file`, y
    // Videasy apenas los toca. Una peli sin subtítulos no sirve, así que
    // VidSrc va delante aunque traiga puerta antirrobot.
    for (const tipo of ["movie", "tv"] as const) {
      const ids = paraTipo(tipo).map((p) => p.id);
      expect(ids.indexOf("vidsrc"), tipo).toBeLessThan(ids.indexOf("videasy"));
      expect(ids.indexOf("vidsrc"), tipo).toBeLessThan(ids.indexOf("vidlink"));
    }
  });

  it("VidSrc es el único de los primeros con subtítulos declarados", () => {
    const conSubtitulos = getProviders()
      .filter((p) => p.spanishSubtitles)
      .map((p) => p.id);
    expect(conSubtitulos).toContain("vidsrc");
  });

  it("queda marcado que VidSrc trae puerta: de ahí la espera corta de la ficha", () => {
    // `ficha-reproductor.tsx` ofrece antes «Probar otro servidor» cuando el
    // servidor activo tiene puerta, porque de ese ya se sabe cómo falla.
    const vidsrc = getProviders().find((p) => p.id === "vidsrc");
    expect(vidsrc?.puertaAntirrobot).toBe(true);
  });

  it("el relevo sin puerta sigue disponible detrás", () => {
    const ids = paraTipo("tv").map((p) => p.id);
    expect(ids).toContain("videasy");
    expect(ids).toContain("vidlink");
  });

  it("todos siguen ahí, en el orden acordado", () => {
    expect(getProviders().map((p) => p.id)).toEqual([
      "vimeus",
      "vidsrc",
      "videasy",
      "vidlink",
      "multiembed",
    ]);
  });

  it("`getProviders` numera sobre la lista COMPLETA, no por tipo", () => {
    // Documenta el reparto: aquí Vimeus es el 1 aunque no cubra series, y por
    // eso `/api/stream` renumera después de filtrar y el respaldo de la ficha
    // se llama «Servidor 1» a mano. Sin esto, en una serie el primer botón
    // decía «Servidor 2» y parecía que faltaba uno.
    expect(getProviders().map((p) => p.label)).toEqual([
      "Servidor 1",
      "Servidor 2",
      "Servidor 3",
      "Servidor 4",
      "Servidor 5",
    ]);
    expect(paraTipo("tv")[0].label).toBe("Servidor 2");
  });
});
