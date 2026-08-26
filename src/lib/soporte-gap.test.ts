import { describe, expect, it } from "vitest";
import { soportaGapEnFlex } from "./soporte-gap";

/**
 * Un documento de mentira, con lo justo.
 *
 * No hace falta jsdom: la comprobación solo crea un div, le pone dos hijos, lo
 * mete en el cuerpo y lee `scrollWidth`. Simulando eso se puede probar el
 * único caso que de verdad importa —un navegador que colapsa el hueco— sin
 * poder tenerlo delante, que es exactamente la situación con un Tizen viejo.
 */
function documentoFalso({ anchoMedido, sinCuerpo = false }: {
  anchoMedido: number;
  sinCuerpo?: boolean;
}) {
  const metidos: unknown[] = [];
  const quitados: unknown[] = [];

  const crear = () => ({
    style: {} as Record<string, string>,
    hijos: [] as unknown[],
    appendChild(hijo: unknown) {
      this.hijos.push(hijo);
    },
    get scrollWidth() {
      return anchoMedido;
    },
  });

  return {
    doc: {
      body: sinCuerpo
        ? null
        : {
            appendChild: (nodo: unknown) => metidos.push(nodo),
            removeChild: (nodo: unknown) => quitados.push(nodo),
          },
      createElement: crear,
    } as unknown as Document,
    metidos,
    quitados,
  };
}

describe("soportaGapEnFlex", () => {
  it("con soporte, el hueco de 1px se mide", () => {
    const { doc } = documentoFalso({ anchoMedido: 1 });
    expect(soportaGapEnFlex(doc)).toBe(true);
  });

  it("**sin soporte el hueco se colapsa a cero**: es el caso de Tizen y webOS", () => {
    // Chromium 53–79 ignora `gap` dentro de un flex. Es lo que hace que en la
    // tele de la sala los botones se toquen entre sí.
    const { doc } = documentoFalso({ anchoMedido: 0 });
    expect(soportaGapEnFlex(doc)).toBe(false);
  });

  it("no deja basura en el documento", () => {
    const { doc, metidos, quitados } = documentoFalso({ anchoMedido: 1 });
    soportaGapEnFlex(doc);
    expect(metidos).toHaveLength(1);
    expect(quitados).toEqual(metidos);
  });

  it("mide con DOS hijos, o el hueco no existiría ni con soporte", () => {
    const { doc, metidos } = documentoFalso({ anchoMedido: 1 });
    soportaGapEnFlex(doc);
    expect((metidos[0] as { hijos: unknown[] }).hijos).toHaveLength(2);
  });

  it("**sin cuerpo todavía, responde que SÍ**", () => {
    // El respaldo solo AÑADE márgenes: ponerlos de más en un navegador moderno
    // se vería peor que no ponerlos en uno viejo. Ante la duda, no tocar nada.
    const { doc } = documentoFalso({ anchoMedido: 0, sinCuerpo: true });
    expect(soportaGapEnFlex(doc)).toBe(true);
  });
});
