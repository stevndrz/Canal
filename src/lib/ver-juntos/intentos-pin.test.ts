import { beforeEach, describe, expect, it } from "vitest";
import { FALLOS_POR_IP, apuntarAcierto, apuntarFallo, puedeIntentar, reiniciarIntentos } from "./intentos-pin";

beforeEach(reiniciarIntentos);

describe("tope de intentos de PIN", () => {
  it("bloquea una IP tras cinco fallos y la suelta al pasar la ventana", () => {
    for (let i = 0; i < FALLOS_POR_IP; i++) {
      expect(puedeIntentar("a", 0).si).toBe(true);
      apuntarFallo("a", 0);
    }
    const bloqueo = puedeIntentar("a", 1000);
    expect(bloqueo.si).toBe(false);
    if (!bloqueo.si) expect(bloqueo.esperaS).toBeGreaterThan(800);
    expect(puedeIntentar("b", 1000).si).toBe(true);
    expect(puedeIntentar("a", 16 * 60_000).si).toBe(true);
  });

  it("cuenta lo que queda", () => {
    expect(apuntarFallo("a", 0)).toBe(FALLOS_POR_IP - 1);
  });

  it("acertar perdona los fallos de esa IP", () => {
    apuntarFallo("a", 0);
    apuntarFallo("a", 0);
    apuntarAcierto("a");
    expect(apuntarFallo("a", 0)).toBe(FALLOS_POR_IP - 1);
  });

  it("quien cambia de IP en cada intento choca con el tope total", () => {
    for (let i = 0; i < 40; i++) apuntarFallo(`ip${i}`, 0);
    expect(puedeIntentar("nueva", 0).si).toBe(false);
  });
});
