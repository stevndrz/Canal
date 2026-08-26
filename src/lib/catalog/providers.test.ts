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
 * ficha, antes de que nadie toque un botón. Estas pruebas lo dejan clavado,
 * porque el bucle de recargas en televisor fue exactamente esto —VidSrc
 * encabezando las series— y no un fallo de lógica.
 */
describe("orden de los proveedores", () => {
  it("en PELÍCULAS manda Vimeus: es el del doblaje latino", () => {
    expect(paraTipo("movie")[0].id).toBe("vimeus");
  });

  it("en SERIES manda Videasy, porque Vimeus no las cubre", () => {
    // La ruta de series de Vimeus responde 404, así que ni aparece.
    expect(paraTipo("tv").map((p) => p.id)).not.toContain("vimeus");
    expect(paraTipo("tv")[0].id).toBe("videasy");
  });

  it("los de puerta antirrobot van los ÚLTIMOS, en película y en serie", () => {
    for (const tipo of ["movie", "tv"] as const) {
      const ids = paraTipo(tipo).map((p) => p.id);
      const conPuerta = paraTipo(tipo)
        .map((p, i) => ({ i, puerta: Boolean(p.puertaAntirrobot) }))
        .filter((p) => p.puerta)
        .map((p) => p.i);
      const sinPuerta = paraTipo(tipo)
        .map((p, i) => ({ i, puerta: Boolean(p.puertaAntirrobot) }))
        .filter((p) => !p.puerta)
        .map((p) => p.i);

      expect(conPuerta.length, `${tipo}: debería haber alguno con puerta`).toBeGreaterThan(0);
      // Todos los que tienen puerta van después de todos los que no.
      expect(Math.min(...conPuerta), `${tipo}: ${ids.join(", ")}`).toBeGreaterThan(
        Math.max(...sinPuerta),
      );
    }
  });

  it("VidSrc NO encabeza las series: eso era el bucle del Samsung", () => {
    // Su página anida `nextgencloudfabric.com`, cuya puerta de Turnstile
    // reacciona a cualquier fallo con `location.reload()`. En el navegador de
    // un televisor no se pasa nunca, así que el marco se recarga sin fin.
    expect(paraTipo("tv")[0].id).not.toBe("vidsrc");
    // Pero sigue disponible: en un teléfono funciona y trae subtítulos en español.
    expect(paraTipo("tv").map((p) => p.id)).toContain("vidsrc");
  });

  it("todos siguen ahí: se reordenan, no se quitan", () => {
    const ids = getProviders().map((p) => p.id);
    expect(ids).toEqual(["vimeus", "videasy", "vidlink", "vidsrc", "multiembed"]);
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
