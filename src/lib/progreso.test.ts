import { describe, expect, it } from "vitest";
import {
  MAX_RECORDADOS,
  OLVIDO_MS,
  TERMINADO_PCT,
  type MemoriaProgreso,
  claveDeFuente,
  claveDeTitulo,
  claveSinEpisodio,
  episodioDeClave,
  enOrden,
  estaTerminado,
  marcar,
  olvidar,
  podar,
  porcentaje,
  posicionGuardada,
  valeLaPena,
} from "./progreso";

/** Una película de hora y media, por el minuto que se diga. */
function aMitad(minuto: number, visto = 1_000): { posicion: number; duracion: number; visto: number } {
  return { posicion: minuto * 60, duracion: 90 * 60, visto };
}

describe("claveDeTitulo", () => {
  it("un episodio se recuerda aparte de sus hermanos", () => {
    // Quien va por el capítulo cuatro no quiere que continuar le lleve al tres.
    expect(claveDeTitulo("tv-42", 1, 3)).not.toBe(claveDeTitulo("tv-42", 1, 4));
    expect(claveDeTitulo("tv-42", 1, 3)).toBe("tv-42-t1e3");
  });

  it("una serie sin episodio concreto no se confunde con una película del mismo id", () => {
    expect(claveDeTitulo("tv-7")).not.toBe(claveDeTitulo("movie-7"));
  });

  it("conserva la clave de la tarjeta tal cual, prefijo de TMDB incluido", () => {
    // El fallo que arregló esta firma: la tarjeta pregunta por
    // `tv-tmdb-125988` y el reproductor guardaba en `tv-125988`.
    expect(claveDeTitulo("tv-tmdb-125988", 1, 1)).toBe("tv-tmdb-125988-t1e1");
    expect(claveSinEpisodio("tv-tmdb-125988-t1e1")).toBe("tv-tmdb-125988");
    expect(episodioDeClave("tv-tmdb-125988-t2e7")).toEqual({ temporada: 2, episodio: 7 });
    expect(episodioDeClave("movie-tmdb-550")).toBeNull();
  });

  it("las fuentes propias tienen su propio espacio", () => {
    expect(claveDeFuente("abc")).toBe("fuente-abc");
  });
});

describe("porcentaje", () => {
  it("redondea a entero, que es lo que pinta la barra", () => {
    expect(porcentaje(aMitad(45))).toBe(50);
  });

  it("una duración de cero no revienta ni devuelve NaN", () => {
    expect(porcentaje({ posicion: 10, duracion: 0, visto: 1 })).toBe(0);
  });

  it("no se pasa de 100 aunque el reproductor sí lo haga", () => {
    // Al terminar, algunos navegadores dejan `currentTime` por encima de
    // `duration` unos milisegundos.
    expect(porcentaje({ posicion: 5_401, duracion: 5_400, visto: 1 })).toBe(100);
  });
});

describe("valeLaPena", () => {
  it("lo apenas empezado no se recuerda", () => {
    // Abrir una ficha y ver los anuncios no es «lo dejé a medias».
    expect(valeLaPena(aMitad(0.2))).toBe(false);
  });

  it("lo terminado tampoco", () => {
    expect(valeLaPena(aMitad(88))).toBe(false);
    expect(estaTerminado(aMitad(88))).toBe(true);
  });

  it("lo que dura menos de dos minutos no se recuerda", () => {
    // Un clip corto: el porcentaje ahí no significa nada.
    expect(valeLaPena({ posicion: 30, duracion: 60, visto: 1 })).toBe(false);
  });

  it("lo de en medio sí", () => {
    expect(valeLaPena(aMitad(45))).toBe(true);
  });

  it("el umbral de terminado es el mismo que pinta la tarjeta", () => {
    // Si se separaran, habría una franja donde la tarjeta no enseña barra pero
    // la fila sigue ofreciendo continuar, y eso se lee como un fallo.
    expect(TERMINADO_PCT).toBe(94);
  });
});

describe("marcar", () => {
  it("guarda por dónde iba", () => {
    const memoria = marcar({}, "peli", aMitad(45));
    expect(posicionGuardada(memoria, "peli")).toBe(45 * 60);
  });

  it("**terminar borra la entrada**, no la guarda al 100", () => {
    // Es lo que hace que la fila se mantenga sola: si no, «Seguir viendo»
    // acabaría siendo la lista de todo lo visto alguna vez.
    const empezada = marcar({}, "peli", aMitad(45));
    const acabada = marcar(empezada, "peli", aMitad(89));
    expect(acabada.peli).toBeUndefined();
    expect(posicionGuardada(acabada, "peli")).toBeUndefined();
  });

  it("no crea entrada por algo que no vale la pena", () => {
    expect(marcar({}, "peli", aMitad(0.1))).toEqual({});
  });

  it("devuelve el MISMO objeto si no hay nada que cambiar", () => {
    // Sin esto, cada tic del vídeo produciría un objeto nuevo y repintaría.
    const memoria: MemoriaProgreso = {};
    expect(marcar(memoria, "peli", aMitad(0.1))).toBe(memoria);
  });

  it("distingue «no hay nada» de «empieza por el principio»", () => {
    // `undefined` y no `0`: quien llama tiene que poder no tocar `currentTime`.
    expect(posicionGuardada({}, "peli")).toBeUndefined();
  });
});

describe("olvidar", () => {
  it("lo que se quita de la fila no vuelve", () => {
    const memoria = marcar({}, "peli", aMitad(45));
    expect(olvidar(memoria, "peli").peli).toBeUndefined();
  });

  it("olvidar lo que no está no cambia nada", () => {
    const memoria = marcar({}, "peli", aMitad(45));
    expect(olvidar(memoria, "otra")).toBe(memoria);
  });
});

describe("enOrden", () => {
  it("lo último que se veía va primero", () => {
    let memoria: MemoriaProgreso = {};
    memoria = marcar(memoria, "vieja", aMitad(45, 1_000));
    memoria = marcar(memoria, "nueva", aMitad(45, 5_000));
    expect(enOrden(memoria).map((e) => e.clave)).toEqual(["nueva", "vieja"]);
  });

  it("no ofrece lo que ya no vale la pena aunque esté guardado", () => {
    // Datos de una versión anterior, u otra pestaña: se filtran al leer.
    const memoria: MemoriaProgreso = { rara: { posicion: 5_400, duracion: 5_400, visto: 1 } };
    expect(enOrden(memoria)).toEqual([]);
  });
});

describe("podar", () => {
  it("olvida lo que lleva noventa días sin tocarse", () => {
    const memoria = marcar({}, "peli", aMitad(45, 1_000));
    expect(podar(memoria, 1_000 + OLVIDO_MS + 1)).toEqual({});
  });

  it("no crece sin fin: se queda con lo más reciente", () => {
    let memoria: MemoriaProgreso = {};
    for (let i = 0; i < MAX_RECORDADOS + 50; i++) {
      memoria = marcar(memoria, `peli-${i}`, aMitad(45, 1_000 + i));
    }
    expect(Object.keys(memoria)).toHaveLength(MAX_RECORDADOS);
    // La última que se vio sobrevive; la primera no.
    expect(memoria[`peli-${MAX_RECORDADOS + 49}`]).toBeDefined();
    expect(memoria["peli-0"]).toBeUndefined();
  });

  it("devuelve el MISMO objeto cuando no hay nada que podar", () => {
    const memoria = marcar({}, "peli", aMitad(45, 1_000));
    expect(podar(memoria, 1_000)).toBe(memoria);
  });
});
