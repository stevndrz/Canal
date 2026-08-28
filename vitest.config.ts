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
      /**
       * `server-only` revienta a propósito fuera del servidor.
       *
       * Es su trabajo: convierte en error de compilación que un módulo con
       * secretos cruce al navegador. Pero aquí no hay navegador ninguno —estas
       * pruebas corren en Node— y sin este alias no se podría probar nada de
       * lo que vive detrás de esa frontera, que es justo lo que más conviene
       * probar. Se sustituye por un módulo vacío.
       */
      "server-only": fileURLToPath(new URL("./src/pruebas/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
