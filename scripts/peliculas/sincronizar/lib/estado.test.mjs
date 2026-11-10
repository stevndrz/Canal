import { describe, expect, it } from "vitest";
import { filas } from "./estado.mjs";
import { planificar } from "./plan.mjs";
import { crearLectorDeProgreso } from "./progreso.mjs";

const sub = (nombre, huella) => ({ nombre, huella, etiqueta: "Español", idioma: "spa", srclang: "es", forzados: false, ruta: `/x/${nombre}` });
const local = (id, titulo, huella, subtitulos = []) => ({
  id,
  titulo,
  anio: null,
  video: { ruta: `/x/${id}.mkv`, nombre: `${id}.mkv`, tamano: 1000, huella },
  subtitulos,
});
const entrada = (id, titulo, extra = {}) => ({ id, titulo, url: `https://pub.r2.dev/peliculas/${id}/master.m3u8`, subtitulos: [], ...extra });
const ver = (locales, catalogo) => filas(locales, catalogo, planificar(locales, catalogo)).peliculas;

describe("estado del panel", () => {
  it("cada película sale una vez, con lo que le pasaría al sincronizar", () => {
    const locales = [
      local("coco", "Coco", "h1"),
      local("dune", "Dune", "h2"),
      local("up", "Up", "h3", [sub("up.es.srt", "s1")]),
    ];
    const catalogo = [
      entrada("coco", "Coco", { origen: { huella: "h1", titulo: "Coco" } }),
      entrada("up", "Up", { origen: { huella: "h3", titulo: "Up" } }),
      entrada("matrix", "Matrix", { origen: { huella: "h9", titulo: "Matrix" } }),
      entrada("her", "Her", { soloNube: true }),
    ];
    const lista = ver(locales, catalogo);
    const de = (t) => lista.find((f) => f.titulo === t);
    expect(lista.map((f) => f.titulo)).toEqual(["Coco", "Dune", "Her", "Matrix", "Up"]);
    expect(de("Coco")).toMatchObject({ estado: "al-dia", enPc: true, enNube: true, id: "coco" });
    expect(de("Dune")).toMatchObject({ estado: "por-subir", enPc: true, enNube: false, id: null, clave: "pc:dune" });
    expect(de("Up")).toMatchObject({ estado: "cambios", cambios: ["subtitulos"], subtitulosPc: ["Español"] });
    expect(de("Matrix")).toMatchObject({ estado: "solo-nube", enPc: false, cambios: ["huerfana"] });
    expect(de("Her")).toMatchObject({ estado: "solo-nube", cambios: [] });
  });

  it("la misma película renombrada sigue siendo una fila, con su título de la app", () => {
    const lista = ver([local("coco-2017", "Coco 2017", "h1")], [entrada("coco", "Coco", { origen: { huella: "h1", titulo: "Coco" } })]);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ estado: "cambios", cambios: ["renombrar"], id: "coco" });
  });

  it("una adoptada (del script viejo) no sale repetida como «solo en la nube»", () => {
    const lista = ver([local("coco", "Coco", "h1")], [entrada("coco", "Coco")]);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ estado: "cambios", cambios: ["adoptar"] });
  });
});

describe("progreso de ffmpeg y rclone", () => {
  it("lee el time= de ffmpeg contra la duración y el % de rclone, sin repetir", () => {
    const avances = [];
    const lector = crearLectorDeProgreso((a) => avances.push(a));
    lector.leer("time=00:00:10.00"); // sin fase: nada
    lector.fase({ fase: "convertir", titulo: "Coco", duracion: 100 });
    lector.leer("frame=1 time=00:00:25.00 bitrate=1\rframe=2 time=00:00:25.40 bit");
    lector.leer("rate=1\rframe=3 time=00:01:");
    lector.leer("40.00 bitrate=1\r");
    lector.fase({ fase: "subir", titulo: "Coco" });
    lector.leer("Transferred:   \t  1 GiB / 2 GiB, 50%, 3 MiB/s, ETA 5m\n");
    lector.fase(null);
    expect(avances).toEqual([
      { fase: "convertir", titulo: "Coco", porcentaje: 0 },
      { fase: "convertir", titulo: "Coco", porcentaje: 25 },
      { fase: "convertir", titulo: "Coco", porcentaje: 100 },
      { fase: "subir", titulo: "Coco", porcentaje: 0 },
      { fase: "subir", titulo: "Coco", porcentaje: 50 },
      null,
    ]);
  });
});
