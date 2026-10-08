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
 * 2026-10-08: Vimeus (latino) primero y Multiembed de recaída, que eran los
 * únicos que le funcionaban. Ver el comentario de `EMBED_PROVIDERS`.
 */
describe("orden de los proveedores", () => {
  it("en PELÍCULAS manda Vimeus: es el del doblaje latino", () => {
    expect(paraTipo("movie")[0].id).toBe("vimeus");
  });

  it("la recaída es Multiembed, justo detrás", () => {
    expect(paraTipo("movie")[1].id).toBe("multiembed");
  });

  it("en SERIES manda Multiembed, porque Vimeus no las cubre", () => {
    // La ruta de series de Vimeus responde 404, así que ni aparece.
    expect(paraTipo("tv").map((p) => p.id)).not.toContain("vimeus");
    expect(paraTipo("tv")[0].id).toBe("multiembed");
  });

  it("todos siguen ahí, en el orden acordado, y los muertos ya no", () => {
    expect(getProviders().map((p) => p.id)).toEqual(["vimeus", "multiembed", "vidzee", "vidrock"]);
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
    // Documenta el reparto: aquí Vimeus es el 1 aunque no cubra series, y por
    // eso `/api/stream` renumera después de filtrar y el respaldo de la ficha
    // se llama «Servidor 1» a mano.
    expect(getProviders().map((p) => p.label)).toEqual([
      "Servidor 1",
      "Servidor 2",
      "Servidor 3",
      "Servidor 4",
    ]);
    expect(paraTipo("tv")[0].label).toBe("Servidor 2");
  });
});
