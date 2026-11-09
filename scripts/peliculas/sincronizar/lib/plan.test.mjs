import { describe, expect, it } from "vitest";
import { carpetaDe, describir, planificar } from "./plan.mjs";

const sub = (nombre, huella, etiqueta = "Español") => ({ nombre, huella, etiqueta, idioma: "spa", srclang: "es", forzados: false, ruta: `/x/${nombre}` });
const local = (id, titulo, huella, subtitulos = []) => ({
  id,
  titulo,
  anio: null,
  video: { ruta: `/x/${id}.mkv`, nombre: `${id}.mkv`, tamano: 2 * 1024 ** 3, huella },
  subtitulos,
});
const entrada = (id, titulo, extra = {}) => ({
  id,
  titulo,
  url: `https://pub.r2.dev/peliculas/${id}/master.m3u8`,
  subtitulos: [],
  ...extra,
});
const tipos = (acciones) => acciones.map((a) => a.tipo);

describe("planificar", () => {
  it("lo nuevo se sube y lo que ya está y no cambió no se toca", () => {
    const igual = entrada("coco", "Coco", { origen: { huella: "h1", titulo: "Coco" } });
    const plan = planificar([local("coco", "Coco", "h1"), local("interstellar", "Interstellar", "h2")], [igual]);
    expect(tipos(plan)).toEqual(["subir"]);
    expect(plan[0].id).toBe("interstellar");
  });

  it("una película subida con el script viejo se adopta, no se vuelve a subir", () => {
    const vieja = entrada("the-hunger-games-catching-fire", "The Hunger Games: Catching Fire", {
      subtitulos: [{ label: "Inglés", srclang: "en", url: "https://pub.r2.dev/peliculas/x/sub0-eng.vtt" }],
    });
    const plan = planificar([local("the-hunger-games-catching-fire", "the-hunger-games-catching-fire", "h9")], [vieja]);
    expect(tipos(plan)).toEqual(["adoptar"]);
  });

  it("renombrar el archivo cambia el título, no vuelve a subir nada", () => {
    const e = entrada("coco", "Coco", { origen: { huella: "h1", titulo: "Coco" } });
    const plan = planificar([local("coco-2017", "Coco 2017 versión buena", "h1")], [e]);
    expect(tipos(plan)).toEqual(["renombrar"]);
    expect(plan[0].titulo).toBe("Coco 2017 versión buena");
  });

  it("un título puesto a mano no se pisa al renombrar el archivo", () => {
    const e = entrada("coco", "Coco (doblaje latino)", { origen: { huella: "h1", titulo: "Coco" } });
    expect(planificar([local("coco", "Coco remux", "h1")], [e])).toEqual([]);
  });

  it("mismo nombre, otro archivo: reemplazar", () => {
    const e = entrada("coco", "Coco", { origen: { huella: "vieja", titulo: "Coco" } });
    expect(tipos(planificar([local("coco", "Coco", "nueva")], [e]))).toEqual(["reemplazar"]);
  });

  it("subtítulos: sube los nuevos y quita los que se borraron; los de dentro del vídeo nunca", () => {
    const e = entrada("coco", "Coco", {
      origen: { huella: "h1", titulo: "Coco" },
      subtitulos: [
        { label: "Inglés", srclang: "en", url: "u1" }, // venía dentro del MKV: sin origen
        { label: "Español", srclang: "es", url: "u2", origen: { archivo: "Coco.es.srt", huella: "s-vieja" } },
        { label: "Portugués", srclang: "pt", url: "u3", origen: { archivo: "Coco.pt.srt", huella: "s-pt" } },
      ],
    });
    const plan = planificar([local("coco", "Coco", "h1", [sub("Coco.es.srt", "s-nueva"), sub("Coco.pt.srt", "s-pt", "Portugués")])], [e]);
    expect(tipos(plan)).toEqual(["subtitulos"]);
    expect(plan[0].nuevos.map((s) => s.huella)).toEqual(["s-nueva"]);
    expect(plan[0].quitar.map((s) => s.url)).toEqual(["u2"]);
  });

  it("un subtítulo del script viejo (sin huella) se reconoce por idioma y no se duplica", () => {
    const vieja = entrada("catching", "Catching Fire", {
      subtitulos: [{ label: "Español", srclang: "es", url: "https://pub.r2.dev/peliculas/catching/sub0-spa.vtt" }],
    });
    const plan = planificar([local("catching", "catching", "h", [{ ...sub("catching.es.srt", "s1"), forzados: false }])], [vieja]);
    const subs = plan.find((a) => a.tipo === "subtitulos");
    expect(subs.nuevos).toEqual([]);
    expect(subs.adoptarSubs.map((a) => a.sub.url)).toEqual(["https://pub.r2.dev/peliculas/catching/sub0-spa.vtt"]);
  });

  it("lo que está en la nube y no en la carpeta es huérfano (se preguntará), y las carpetas sueltas, basura", () => {
    const e = entrada("coco", "Coco", { origen: { huella: "h1", titulo: "Coco" } });
    const plan = planificar([], [e], { carpetasNube: ["coco", "interstellar-a1b2"] });
    expect(tipos(plan)).toEqual(["huerfana", "basura"]);
    expect(plan[1].carpeta).toBe("interstellar-a1b2");
  });

  it("una marcada «solo en la nube» no se da por huérfana", () => {
    const e = entrada("coco", "Coco", { origen: { huella: "h1", titulo: "Coco" }, soloNube: true });
    expect(planificar([], [e])).toEqual([]);
  });

  it("un id ocupado por otra película da uno libre", () => {
    const e = entrada("coco", "Coco", { origen: { huella: "h1", titulo: "Coco" } });
    const plan = planificar([local("coco", "Coco", "h1"), local("coco", "Coco", "otra")], [e]);
    expect(plan.find((a) => a.tipo === "subir")?.id).toBe("coco-2");
  });

  it("dice el plan en palabras", () => {
    expect(describir({ tipo: "subir", local: local("coco", "Coco", "h", [sub("a.srt", "s")]) })).toBe("Subir «Coco» (2,0 GB, 1 subtítulo(s))");
  });
});

describe("carpetaDe", () => {
  it("sale de la URL o del campo carpeta", () => {
    expect(carpetaDe({ url: "https://pub.r2.dev/peliculas/coco-a1b2/master.m3u8" })).toBe("coco-a1b2");
    expect(carpetaDe({ carpeta: "x", url: "" })).toBe("x");
    expect(carpetaDe({ url: "rara" })).toBeNull();
  });
});
