import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Los `.cmd` de doble clic. No se pueden ejecutar aquí (no hay cmd.exe), pero
 * sí vigilar las dos cosas que ya fallaron en el PC del dueño: llamar a `node`
 * a secas (el Explorador hereda un PATH viejo y no lo encuentra) y los saltos
 * de línea (cmd.exe se pierde con `goto` en un archivo sin CRLF).
 */
const carpeta = join(dirname(fileURLToPath(import.meta.url)), "..");
const guiones = readdirSync(carpeta).filter((n) => n.endsWith(".cmd"));

describe("los .cmd de doble clic", () => {
  it("están todos", () => {
    expect(guiones).toEqual(expect.arrayContaining(["buscar-node.cmd", "panel.cmd", "sincronizar.cmd", "sincronizar-sola.cmd"]));
  });

  for (const nombre of guiones) {
    const texto = readFileSync(join(carpeta, nombre), "latin1");

    it(`${nombre}: saltos de línea de Windows y solo ASCII`, () => {
      expect(texto.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
      expect(texto).toMatch(/^[\x00-\x7f]*$/);
    });

    if (/\.mjs/.test(texto)) {
      it(`${nombre}: lanza Node por su ruta completa (buscar-node.cmd), no por el PATH`, () => {
        expect(texto).toContain('call "%~dp0buscar-node.cmd"');
        expect(texto).toMatch(/^"%NODE_EXE%" "%~dp0sincronizar\\\w+\.mjs" %\*/m);
        expect(texto).not.toMatch(/^\s*node\s/im);
        expect(texto).not.toMatch(/where node\b/i);
      });
    }
  }
});
