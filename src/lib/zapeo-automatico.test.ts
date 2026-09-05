import { describe, expect, it } from "vitest";
import { MAX_SALTOS, siguienteCandidato, type Candidato } from "./zapeo-automatico";

const LISTA: Candidato[] = [1, 2, 3, 4].map((id) => ({ id, streamUrl: `http://c/${id}` }));
const NINGUNO = () => false;

function buscar(actualId: number, descartados: number[] = [], apartados: number[] = []) {
  return siguienteCandidato({
    lista: LISTA,
    actualId,
    descartados: new Set([actualId, ...descartados]),
    estaApartado: (canal) => apartados.includes(canal.id),
  });
}

describe("siguienteCandidato", () => {
  it("es el de después en la lista que se está mirando", () => {
    expect(buscar(1)?.id).toBe(2);
  });

  it("da la vuelta al llegar al final", () => {
    expect(buscar(4)?.id).toBe(1);
  });

  it("no vuelve a probar lo ya probado en esta cadena", () => {
    // Sin esto, dos canales muertos seguidos se rebotarían para siempre.
    expect(buscar(2, [3])?.id).toBe(4);
  });

  it("se salta los que la memoria de caídos ya tiene apartados", () => {
    expect(buscar(1, [], [2, 3])?.id).toBe(4);
  });

  it("pero prueba un apartado antes que rendirse", () => {
    // La lista resucita canales continuamente: probar uno apartado es mejor
    // que dejar a alguien sin imagen por una nota de hace tres días.
    expect(buscar(1, [], [2, 3, 4])?.id).toBe(2);
  });

  it("se rinde al agotar el tope de saltos", () => {
    // Una cadena larga se ve como una app fuera de control, no como una que
    // ayuda: si cinco seguidos fallan, el problema no es el canal.
    const descartados = new Set([1, 2, 3, 4, 5].slice(0, MAX_SALTOS));
    expect(
      siguienteCandidato({ lista: LISTA, actualId: 1, descartados, estaApartado: NINGUNO }),
    ).toBeNull();
  });

  it("no salta si el canal actual ya no está en la lista visible", () => {
    // Se filtró mientras fallaba: sin punto de partida, saltar sería aparecer
    // en otra parte de la parrilla sin avisar.
    expect(buscar(99)).toBeNull();
  });

  it("con un solo canal no hay a dónde ir", () => {
    expect(
      siguienteCandidato({
        lista: [LISTA[0]],
        actualId: 1,
        descartados: new Set([1]),
        estaApartado: NINGUNO,
      }),
    ).toBeNull();
  });

  it("una lista vacía no revienta", () => {
    expect(
      siguienteCandidato({ lista: [], actualId: 1, descartados: new Set(), estaApartado: NINGUNO }),
    ).toBeNull();
  });
});
