import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { leerJsonCatalogo } from "../lib/nube.mjs";

/** Una «nube» que es una carpeta: la misma interfaz que `crearNubeRclone`. */
export function crearNubeLocal(raiz) {
  const ruta = (r) => join(raiz, r);
  return {
    descripcion: `local:${raiz}`,
    urlPublica: (r) => `https://pub.ejemplo.r2.dev/${r}`,
    escrituras: 0,
    async listarCarpetas() {
      try {
        return (await readdir(ruta("peliculas"), { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
      } catch {
        return [];
      }
    },
    async leerCatalogo() {
      try {
        return leerJsonCatalogo(await readFile(ruta("peliculas/catalogo.json"), "utf8"));
      } catch (error) {
        if (error?.code === "ENOENT") return [];
        throw error;
      }
    },
    async escribirCatalogo(peliculas) {
      this.escrituras++;
      await mkdir(ruta("peliculas"), { recursive: true });
      await writeFile(ruta("peliculas/catalogo.json"), JSON.stringify({ version: 2, peliculas }, null, 2));
    },
    async subirCarpeta(local, remota) {
      await mkdir(ruta(remota), { recursive: true });
      await cp(local, ruta(remota), { recursive: true });
    },
    async subirArchivo(local, remota) {
      await mkdir(dirname(ruta(remota)), { recursive: true });
      await cp(local, ruta(remota));
    },
    async borrarCarpeta(remota) {
      await rm(ruta(remota), { recursive: true, force: true });
    },
    async borrarArchivo(remota) {
      await rm(ruta(remota), { force: true });
    },
    async tamanoTotal() {
      return 0;
    },
    async existe(remota) {
      return stat(ruta(remota)).then(() => true, () => false);
    },
  };
}
