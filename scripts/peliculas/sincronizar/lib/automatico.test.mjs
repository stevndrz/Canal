import { describe, expect, it } from "vitest";
import { argumentosCrear, guionOculto, NOMBRE_TAREA, textoDeEstado } from "./automatico.mjs";
import { soloLoQueAnade } from "./sincronizar.mjs";

describe("sincronizar sola: la tarea de Windows", () => {
  it("el lanzador no abre ventana y aguanta rutas con espacios", () => {
    const vbs = guionOculto("C:\\Program Files\\nodejs\\node.exe", "C:\\Users\\Ana Lu\\Canal\\scripts\\peliculas\\sincronizar\\sincronizar.mjs");
    expect(vbs).toContain(
      '.Run """C:\\Program Files\\nodejs\\node.exe"" ""C:\\Users\\Ana Lu\\Canal\\scripts\\peliculas\\sincronizar\\sincronizar.mjs"" --automatico", 0, False',
    );
    expect(vbs.split("\r\n").length).toBeGreaterThan(2);
  });

  it("schtasks: cada diez minutos, pisando la que hubiera, sin shell de por medio", () => {
    expect(argumentosCrear("C:\\Users\\Ana Lu\\AppData\\Local\\CanalCasa\\sincronizar-oculto.vbs")).toEqual([
      "/Create", "/TN", NOMBRE_TAREA,
      "/TR", 'wscript.exe "C:\\Users\\Ana Lu\\AppData\\Local\\CanalCasa\\sincronizar-oculto.vbs"',
      "/SC", "MINUTE", "/MO", "10", "/F",
    ]);
    expect(() => argumentosCrear('C:\\x" & del *.*')).toThrow();
  });
});

describe("sincronizar sola: qué se hace sin preguntar", () => {
  const entrada = { titulo: "Coco" };
  const local = { titulo: "Coco", video: { tamano: 1, nombre: "coco.mkv" }, subtitulos: [] };

  it("lo que añade se hace; lo que quita algo de la nube queda pendiente", () => {
    const pendientes = [];
    const plan = [
      { tipo: "subir", local },
      { tipo: "renombrar", entrada, local, titulo: "Coco (latino)" },
      { tipo: "huerfana", entrada: { titulo: "Matrix" } },
      { tipo: "basura", carpeta: "resto-abc123" },
      { tipo: "reemplazar", entrada, local },
    ];
    expect(soloLoQueAnade(plan, pendientes).map((a) => a.tipo)).toEqual(["subir", "renombrar"]);
    expect(pendientes).toHaveLength(3);
    expect(pendientes[0]).toContain("Matrix");
  });

  it("subtítulos: los nuevos se suben, los borrados de la carpeta NO se quitan de la nube", () => {
    const pendientes = [];
    const nuevo = { etiqueta: "Español" };
    const viejo = { label: "Inglés" };
    const [accion] = soloLoQueAnade([{ tipo: "subtitulos", entrada, local, nuevos: [nuevo], quitar: [viejo], adoptarSubs: [] }], pendientes);
    expect(accion.nuevos).toEqual([nuevo]);
    expect(accion.quitar).toEqual([]);
    expect(pendientes).toHaveLength(1);
    // Si solo había que quitar, no queda nada que hacer.
    expect(soloLoQueAnade([{ tipo: "subtitulos", entrada, local, nuevos: [], quitar: [viejo], adoptarSubs: [] }], [])).toEqual([]);
  });
});

describe("sincronizar sola: el archivo de estado", () => {
  const cuando = "2026-11-09 21:30";
  it("dice qué se subió y qué espera a la persona", () => {
    const texto = textoDeEstado({ cuando, resultado: { subidas: ["Coco"], pendientes: ["«Matrix» está en la nube pero no en la carpeta"], hechas: 1, fallidas: 0 } });
    expect(texto).toContain("+ Coco");
    expect(texto).toContain("PENDIENTE DE TI");
    expect(texto).toContain("? «Matrix»");
    expect(texto).toMatch(/\r\n/);
  });
  it("sin nada que hacer, lo dice en una línea", () => {
    expect(textoDeEstado({ cuando, resultado: { subidas: [], pendientes: [], hechas: 0, fallidas: 0 } })).toContain("Todo al dia");
  });
  it("un fallo se lee sin abrir el registro", () => {
    expect(textoDeEstado({ cuando, error: "rclone no llega a R2" })).toContain("NO SE PUDO SINCRONIZAR");
  });
});
