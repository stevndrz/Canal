import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Pruebas de la lógica pura, no de la interfaz.
 *
 * Lo que se prueba aquí son funciones sin React, sin red y sin navegador:
 * analizar una lista M3U, clasificar un canal, leer un magnet, formatear un
 * texto. Es donde viven las reglas que se rompen en silencio — un cambio en
 * una expresión regular no da error de compilación, y sin prueba se descubre
 * cuando a alguien se le queda un canal fuera de su categoría.
 *
 * Los componentes se siguen verificando con Playwright contra la app real
 * (`docs/ARQUITECTURA.md` explica el reparto): montar React en jsdom pone a
 * prueba el montaje, no el producto.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
