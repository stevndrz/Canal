import { describe, expect, it } from "vitest";
import { hayQueCorregir, leerMensajeReloj, leerMinuto, leerReloj, pausarReloj, reanudarReloj, relojEn, RELOJ_PARADO } from "./reloj";

describe("reloj de sala", () => {
  it("parado no avanza; en marcha cuenta con el cronómetro local", () => {
    expect(leerReloj(RELOJ_PARADO, 99_000)).toBe(0);
    const r = relojEn(0, false, 1000);
    expect(leerReloj(r, 1000 + 754_000)).toBe(754);
  });

  it("pausar congela donde iba y reanudar sigue desde ahí", () => {
    const pausado = pausarReloj(relojEn(600, false, 0), 30_000);
    expect(leerReloj(pausado, 500_000)).toBe(630);
    expect(leerReloj(reanudarReloj(pausado, 500_000), 510_000)).toBe(640);
  });

  it("«voy por…» mueve el reloj sin cambiar si corre o no", () => {
    expect(leerReloj(relojEn(1500, true, 0), 60_000)).toBe(1500);
    expect(leerReloj(relojEn(1500, false, 0), 60_000)).toBe(1560);
  });

  it("el pulso solo corrige si la diferencia se nota", () => {
    const r = relojEn(100, false, 0);
    expect(hayQueCorregir(r, 110.4, false, 10_000)).toBe(false);
    expect(hayQueCorregir(r, 115, false, 10_000)).toBe(true);
    expect(hayQueCorregir(r, 110, true, 10_000)).toBe(true);
  });

  it("entiende el minuto como lo escribe una persona", () => {
    expect(leerMinuto("12:34")).toBe(754);
    expect(leerMinuto("1:02:03")).toBe(3723);
    expect(leerMinuto("47")).toBe(47 * 60);
    expect(leerMinuto(" 5.30 ")).toBe(330);
    expect(leerMinuto("12:75")).toBeNull();
    expect(leerMinuto("ayer")).toBeNull();
    expect(leerMinuto("")).toBeNull();
  });

  it("los mensajes de fuera se leen con desconfianza", () => {
    expect(leerMensajeReloj({ tipo: "reloj", tiempo: 12, pausado: false })).toEqual({ tipo: "reloj", tiempo: 12, pausado: false, pulso: false });
    expect(leerMensajeReloj({ tipo: "reloj", tiempo: -1, pausado: false })).toBeNull();
    expect(leerMensajeReloj({ tipo: "reloj", tiempo: "12", pausado: false })).toBeNull();
    expect(leerMensajeReloj({ tipo: "listo" })).toBeNull();
    expect(leerMensajeReloj({ tipo: "titulo", titulo: { ruta: "/peliculas/tv/tmdb-1399?t=2", nombre: "Juego" } })).toMatchObject({ tipo: "titulo" });
    // Nada que saque de la app ni que no sea una ficha.
    expect(leerMensajeReloj({ tipo: "titulo", titulo: { ruta: "https://malo.example/x", nombre: "x" } })).toBeNull();
    expect(leerMensajeReloj({ tipo: "titulo", titulo: { ruta: "//malo.example", nombre: "x" } })).toBeNull();
    expect(leerMensajeReloj({ tipo: "titulo", titulo: { ruta: "/peliculas/movie/tmdb-1/../../api", nombre: "x" } })).toBeNull();
    expect(leerMensajeReloj({ tipo: "titulo", titulo: { ruta: "/peliculas/movie/tmdb-1?next=//malo.example", nombre: "x" } })).toBeNull();
    expect(leerMensajeReloj("hola")).toBeNull();
  });
});
