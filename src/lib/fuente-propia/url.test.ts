import { describe, expect, it } from "vitest";
import { claseDeUrl, esEnlaceFirmado, resolverFuente, tituloDesdeUrl, urlUtilizable } from "./url";

const HASH = "c9e15763f722f23e98a29decdfae341b98d53056";

describe("claseDeUrl", () => {
  it("reconoce cada formato por su extensión", () => {
    expect(claseDeUrl("https://a.com/v.m3u8")).toBe("hls");
    expect(claseDeUrl("https://a.com/v.ts")).toBe("mpegts");
    expect(claseDeUrl("https://a.com/v.mkv")).toBe("matroska");
    expect(claseDeUrl("https://a.com/v.mp4")).toBe("nativo");
    expect(claseDeUrl(`magnet:?xt=urn:btih:${HASH}`)).toBe("magnet");
  });

  it("ignora la cadena de consulta al mirar la extensión", () => {
    // El caso real: los servidores de descarga directa firman así sus URLs.
    expect(claseDeUrl("https://s9.ejemplo.net/v/a.mp4?t=abc&e=43200&s=1787")).toBe("nativo");
  });

  it("no se deja engañar por una extensión a media URL", () => {
    expect(claseDeUrl("https://a.com/no-es.mp4.txt")).toBe("desconocida");
  });
});

describe("urlUtilizable", () => {
  it("solo deja pasar http y https", () => {
    expect(urlUtilizable("https://a.com/v.mp4")).toBe(true);
    expect(urlUtilizable("http://a.com/v.mp4")).toBe(true);
    // Es la comprobación que impide que esto llegue al `src` de un <video>.
    expect(urlUtilizable("javascript:alert(1)")).toBe(false);
    expect(urlUtilizable("data:text/html,<script>")).toBe(false);
    expect(urlUtilizable("no es una url")).toBe(false);
  });
});

describe("esEnlaceFirmado", () => {
  it("detecta token y caducidad", () => {
    expect(esEnlaceFirmado("https://a.com/v.mp4?t=abc&e=43200")).toBe(true);
    expect(esEnlaceFirmado("https://a.com/v.mp4?expires=99")).toBe(true);
  });

  it("no marca un enlace normal", () => {
    expect(esEnlaceFirmado("https://a.com/v.mp4")).toBe(false);
    expect(esEnlaceFirmado("https://a.com/v.mp4?calidad=alta")).toBe(false);
  });
});

describe("tituloDesdeUrl", () => {
  it("saca un nombre legible del archivo", () => {
    expect(tituloDesdeUrl("https://a.com/mi_pelicula_favorita.mp4")).toBe("mi pelicula favorita");
  });

  it("cae al servidor cuando el archivo es un hash", () => {
    // Poner "azlpa-7415e0f3…" de título es peor que no poner nada.
    expect(tituloDesdeUrl("https://s9.vimeos.net/v/azlpa-7415e0f3a89a00ce9b77067047cd2822.mp4"))
      .toBe("s9.vimeos.net");
  });

  it("prefiere el `dn=` de un magnet", () => {
    expect(tituloDesdeUrl(`magnet:?xt=urn:btih:${HASH}&dn=Mi.Pelicula.2024`)).toBe("Mi Pelicula 2024");
  });
});

describe("resolverFuente", () => {
  it("acepta un enlace normal con su aviso vacío", () => {
    const r = resolverFuente("https://a.com/v.mp4");
    expect(r).toEqual({ ok: true, url: "https://a.com/v.mp4", aviso: "" });
  });

  it("avisa de un .mkv pero lo deja pasar", () => {
    const r = resolverFuente("https://a.com/v.mkv");
    expect(r.ok).toBe(true);
    expect(r.ok && r.aviso).toContain(".mkv");
  });

  it("resuelve un magnet con web seed a su URL reproducible", () => {
    const r = resolverFuente(
      `magnet:?xt=urn:btih:${HASH}&dn=Peli&ws=https%3A%2F%2Fcdn.a.com%2Fp.mp4`,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.url).toBe("https://cdn.a.com/p.mp4");
      expect(r.magnet).toContain("magnet:?");
    }
  });

  it("rechaza un magnet sin web seed explicando el motivo", () => {
    const r = resolverFuente(`magnet:?xt=urn:btih:${HASH}&dn=Peli`);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain("BitTorrent");
  });

  it("rechaza un protocolo que no se puede reproducir", () => {
    const r = resolverFuente("javascript:alert(1)");
    expect(r.ok).toBe(false);
  });
});
