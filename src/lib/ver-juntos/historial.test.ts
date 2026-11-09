import { describe, expect, it } from "vitest";
import { apuntar, dondeRetomar, leerHistorial, MAX_HISTORIAL, reloj, resumen, type VistaJuntos } from "./historial";

const vista = (extra: Partial<VistaJuntos> = {}): VistaJuntos => ({
  url: "https://pub.ejemplo.r2.dev/peliculas/coco/master.m3u8",
  titulo: "Coco",
  posicion: 2830,
  duracion: 6300,
  visto: 1_000_000,
  con: ["Tele sala"],
  ...extra,
});

describe("seguir viendo juntos", () => {
  it("ofrece retomar solo si de verdad se quedó a medias", () => {
    expect(dondeRetomar(vista())).toBe(2830);
    expect(dondeRetomar(vista({ posicion: 20 }))).toBeNull();
    expect(dondeRetomar(vista({ posicion: 6200 }))).toBeNull();
    expect(dondeRetomar(undefined)).toBeNull();
    // Sin duración conocida, se ofrece igual.
    expect(dondeRetomar(vista({ duracion: 0 }))).toBe(2830);
  });

  it("apuntar actualiza la misma película y la sube arriba, sin duplicarla", () => {
    const otra = vista({ url: "https://x.dev/matrix.m3u8", titulo: "Matrix", visto: 2_000_000 });
    const h = apuntar(apuntar([], vista()), otra);
    const despues = apuntar(h, vista({ posicion: 3000, visto: 3_000_000 }));
    expect(despues.map((v) => v.titulo)).toEqual(["Coco", "Matrix"]);
    expect(despues[0]!.posicion).toBe(3000);
  });

  it("verla un rato a solas no borra con quién se vio", () => {
    const [v] = apuntar([vista()], vista({ con: [], posicion: 2900 }));
    expect(v!.con).toEqual(["Tele sala"]);
  });

  it("no crece sin fin", () => {
    let h: VistaJuntos[] = [];
    for (let i = 0; i < MAX_HISTORIAL + 10; i++) h = apuntar(h, vista({ url: `https://x.dev/${i}.m3u8`, visto: i }));
    expect(h).toHaveLength(MAX_HISTORIAL);
    expect(h[0]!.url).toContain(`/${MAX_HISTORIAL + 9}.m3u8`);
  });

  it("lo guardado se lee con desconfianza", () => {
    expect(leerHistorial(null)).toEqual([]);
    expect(leerHistorial("x")).toEqual([]);
    const leido = leerHistorial([
      vista(),
      { url: "javascript:alert(1)", titulo: "mala" },
      { ...vista(), posicion: "muchos" },
      { url: "https://x.dev/b.m3u8", posicion: -5, con: [1, "Steven"], visto: 5_000_000 },
    ]);
    expect(leido.map((v) => v.url)).toEqual(["https://x.dev/b.m3u8", vista().url]);
    expect(leido[0]).toMatchObject({ posicion: 0, con: ["Steven"], titulo: "" });
  });

  it("los textos", () => {
    expect(reloj(70)).toBe("1:10");
    expect(reloj(3723)).toBe("1:02:03");
    expect(resumen(vista(), 1_000_000 + 86_400_000)).toBe("Iban por 47:10 de 1:45:00 · con Tele sala · ayer");
    expect(resumen(vista({ posicion: 6200, con: [] }), 1_000_000)).toBe("Terminada · hoy");
  });
});
