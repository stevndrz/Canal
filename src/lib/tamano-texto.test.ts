import { describe, expect, it } from "vitest";
import { GUION_ARRANQUE_PANTALLA } from "./tamano-texto";

/**
 * El guion de arranque es una cadena que el navegador ejecuta tal cual, sin
 * compilador de por medio: un error de sintaxis ahí no lo ve `tsc` y deja la
 * app sin modo televisor. Se ejecuta aquí contra un documento de mentira.
 */
function ejecutar(userAgent: string, guardado: string | null) {
  const atributos: Record<string, string> = {};
  const documento = { documentElement: { setAttribute: (k: string, v: string) => (atributos[k] = v) } };
  const almacen = { getItem: () => guardado };
  new Function("document", "navigator", "localStorage", GUION_ARRANQUE_PANTALLA)(
    documento,
    { userAgent },
    almacen,
  );
  return atributos;
}

const TIZEN = "Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 TV Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

describe("GUION_ARRANQUE_PANTALLA", () => {
  it("marca el televisor y deja en paz al teléfono", () => {
    expect(ejecutar(TIZEN, null)).toEqual({ "data-pantalla": "tv" });
    expect(ejecutar(IPHONE, null)).toEqual({});
  });

  it("recupera el tamaño de texto guardado", () => {
    expect(ejecutar(IPHONE, "grande")).toEqual({ "data-texto": "grande" });
    expect(ejecutar(TIZEN, "enorme")).toEqual({ "data-pantalla": "tv", "data-texto": "enorme" });
  });

  it("ignora un valor guardado que no conoce", () => {
    expect(ejecutar(IPHONE, "<script>")).toEqual({});
  });
});
