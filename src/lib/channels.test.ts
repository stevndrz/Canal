import { describe, expect, it } from "vitest";
import {
  ampliarTramo,
  buscarUltimo,
  cadenaDeZapeo,
  canalDeArranque,
  canalesDelTramo,
  stepChannel,
  tramoDeCanal,
  type SeccionZapeo,
} from "./channels";
import {
  desempaquetarCanales,
  empaquetarCanales,
  recortarPaquete,
  type CanalDeOrigen,
} from "./canales-empaquetados";
import { indexarCanales, normalizarCasa } from "./secciones-canales";
import type { Channel } from "./types";

function canal(name: string, tema: string, pais: string): CanalDeOrigen {
  return {
    name,
    category: pais === "gt" ? "Guatemala" : "Internacional",
    logoUrl: "",
    streamUrl: `https://stream.test/${encodeURIComponent(name)}.m3u8`,
    tema,
    pais,
  };
}

/** El orden de `m3u.ts` no es el de las secciones: el chino va el último. */
const PAQUETE = empaquetarCanales([
  canal("Canal 3", "Generalista", "gt"),
  canal("Canal 7", "Generalista", "gt"),
  canal("Guatevision", "Generalista", "gt"),
  canal("TN23", "Noticias", "gt"),
  canal("HCH", "Noticias", "hn"),
  canal("Canal 11 TuTV", "Generalista", "sv"),
  canal("TUDN", "Deportes", "mx"),
  canal("餘姚姚江文化", "Generalista", "cn"),
]);
const CANALES = desempaquetarCanales(PAQUETE);
const por = (nombre: string) => CANALES.find((c) => c.name === nombre)!;
const nombres = (lista: Channel[]) => lista.map((c) => c.name);

const CASA = [por("Canal 3"), por("Canal 7"), por("Guatevision")];
const CADENA = cadenaDeZapeo(
  indexarCanales(CANALES, normalizarCasa(["Canal 3", "Canal 7", "Guatevision"])),
  CASA,
  new Set(),
);

describe("stepChannel", () => {
  it("no da la vuelta: en un extremo no hay siguiente", () => {
    const lista = CASA;
    expect(stepChannel(lista, por("Canal 7").id, -1)?.name).toBe("Canal 3");
    expect(stepChannel(lista, por("Canal 3").id, -1)).toBeNull();
    expect(stepChannel(lista, por("Guatevision").id, 1)).toBeNull();
  });
});

describe("contexto de zapeo", () => {
  it("al arrancar es «Mis canales y Guatemala», con la casa delante y sin repetir", () => {
    const tramo = tramoDeCanal(CADENA, por("Canal 7").id)!;
    expect(tramo).toEqual({ desde: 0, hasta: 0 });
    expect(nombres(canalesDelTramo(CADENA, tramo))).toEqual(["Canal 3", "Canal 7", "Guatevision", "TN23"]);
  });

  it("↑↑ desde Canal 7 se queda en Guatemala: nunca salta a la cola del mundo", () => {
    let tramo = tramoDeCanal(CADENA, por("Canal 7").id)!;
    let actual = por("Canal 7");
    for (let i = 0; i < 3; i++) {
      const siguiente = stepChannel(canalesDelTramo(CADENA, tramo), actual.id, -1);
      if (siguiente) actual = siguiente;
      tramo = ampliarTramo(CADENA, tramo, actual.id);
    }
    expect(actual.name).toBe("Canal 3");
    expect(tramo).toEqual({ desde: 0, hasta: 0 });
  });

  it("al llegar al final pasa a la sección siguiente, saltándose las vacías", () => {
    const tramo = tramoDeCanal(CADENA, por("TN23").id)!;
    const ampliado = ampliarTramo(CADENA, tramo, por("TN23").id);
    expect(ampliado).toEqual({ desde: 0, hasta: 1 });
    const lista = canalesDelTramo(CADENA, ampliado);
    expect(stepChannel(lista, por("TN23").id, 1)?.name).toBe("Canal 11 TuTV");
  });

  it("desde una sección, al llegar al principio se suma la anterior", () => {
    const tramo = tramoDeCanal(CADENA, por("TUDN").id)!;
    expect(CADENA[tramo.desde].clave).toBe("mexico");
    const ampliado = ampliarTramo(CADENA, tramo, por("TUDN").id);
    expect(CADENA[ampliado.desde].clave).toBe("centroamerica");
    // TUDN es a la vez el primero y el último de México: se suman las dos
    // vecinas con canales (Caribe, Sudamérica, España y EE. UU. van vacías).
    expect(CADENA[ampliado.hasta].clave).toBe("mundo");
  });

  it("si no cambia nada devuelve el mismo tramo (no repinta)", () => {
    const secciones: SeccionZapeo[] = [{ clave: "x", titulo: "X", canales: CASA }];
    const tramo = { desde: 0, hasta: 0 };
    expect(ampliarTramo(secciones, tramo, por("Canal 7").id)).toBe(tramo);
  });

  it("los caídos van al final de su sección", () => {
    const cadena = cadenaDeZapeo(
      indexarCanales(CANALES, normalizarCasa(["Canal 3", "Canal 7", "Guatevision"])),
      CASA,
      new Set([por("Canal 3").id]),
    );
    expect(nombres(canalesDelTramo(cadena, { desde: 0, hasta: 0 }))).toEqual([
      "Canal 7",
      "Guatevision",
      "TN23",
      "Canal 3",
    ]);
  });
});

describe("último canal al arrancar", () => {
  const ultimo = { id: por("TUDN").id, nombre: "TUDN" };

  it("si el guardado no vino en el recorte, no se da por encontrado", () => {
    // El recorte del HTML solo trae los de la casa.
    const recorte = desempaquetarCanales(recortarPaquete(PAQUETE, [0, 1, 2]));
    expect(buscarUltimo(recorte, ultimo)).toBeNull();
    // …y el arranque cae a lo de siempre mientras tanto.
    expect(canalDeArranque(recorte, ultimo)).toBe(por("Canal 7").id);
  });

  it("con la lista completa sí se encuentra, por su sitio o por su nombre", () => {
    expect(buscarUltimo(CANALES, ultimo)).toBe(por("TUDN").id);
    expect(buscarUltimo(CANALES, { id: 1, nombre: "TUDN" })).toBe(por("TUDN").id);
    expect(buscarUltimo(CANALES, { id: 1, nombre: "Ya no existe" })).toBeNull();
  });

  it("en el recorte, el id es la posición en la lista completa, no el índice", () => {
    const recorte = desempaquetarCanales(recortarPaquete(PAQUETE, [1, 6]));
    expect(buscarUltimo(recorte, ultimo)).toBe(por("TUDN").id);
  });
});
