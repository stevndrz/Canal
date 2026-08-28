import { describe, expect, it } from "vitest";
import { paraRegistro } from "./url-segura";

describe("paraRegistro", () => {
  it("borra la consulta, que es donde viajan las credenciales IPTV", () => {
    // El formato Xtream Codes, que es el que reparte casi todo el sector.
    expect(
      paraRegistro("http://portal.example:8080/get.php?username=juan&password=s3cr3t&type=m3u"),
    ).toBe("http://portal.example:8080/get.php?…");
  });

  it("conserva host y ruta: sin ellos el registro no sirve para nada", () => {
    expect(paraRegistro("https://ejemplo.test/listas/gt.m3u")).toBe(
      "https://ejemplo.test/listas/gt.m3u",
    );
  });

  it("marca la credencial escrita en la propia autoridad", () => {
    expect(paraRegistro("https://juan:s3cr3t@ejemplo.test/epg.xml")).toBe(
      "https://[credencial]@ejemplo.test/epg.xml",
    );
  });

  it("no devuelve el texto original cuando no es una URL", () => {
    // Podría ser justamente la credencial mal pegada.
    expect(paraRegistro("s3cr3t")).toBe("[url no válida]");
  });
});
