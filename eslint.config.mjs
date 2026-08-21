import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
// El plugin viene de dependencia de `eslint-config-next`; se importa
// explícitamente porque una regla suya solo se puede activar en el mismo
// objeto de configuración que lo declara.
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default defineConfig([
  // La exportación de configuración plana que de verdad funciona con el
  // ESLint y el Next fijados en package.json.
  ...nextCoreWebVitals,

  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      /**
       * Código muerto, tratado como error.
       *
       * El preajuste de Next no activa esta regla, y eso dejó siete
       * importaciones sin usar en `dashboard.tsx` después de extraer las
       * vistas: `npm run lint` pasaba limpio con siete módulos importándose
       * para nada. Eso además engorda el paquete y hace creer que un archivo
       * depende de cosas de las que ya no depende.
       *
       * `argsIgnorePattern` con guion bajo es la vía de escape habitual para
       * un argumento que hay que declarar por posición pero no se usa, como
       * el `_event` de un manejador.
       */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
    },
  },

  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
