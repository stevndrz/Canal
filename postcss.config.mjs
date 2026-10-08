/**
 * `@csstools/postcss-cascade-layers` va DESPUÉS de Tailwind, y por un motivo:
 * Chromium < 99 descarta entera cualquier regla dentro de `@layer`, y Tailwind
 * 4 lo mete casi todo ahí. En una Samsung de 2019 (Chromium 63) o una LG de
 * 2019 (Chromium 53) la app salía sin un solo estilo. El plugin quita las
 * capas y conserva su orden subiendo la especificidad con `:not(#\#)`, que es
 * lo que hace que «sin capa gana a con capa» siga siendo verdad.
 *
 * Lightning CSS (el que usa Turbopack después) no sabe aplanar capas; por eso
 * esto tiene que pasar aquí. Ver `docs/equipo/diseno.md`.
 *
 * `respaldo-tv` añade valores fijos para `clamp()/min()/max()` (Chromium 79),
 * que en esas mismas teles invalidaban 230 declaraciones. Ver el archivo.
 */
import { fileURLToPath } from "node:url";

// Ruta absoluta: Turbopack evalúa este archivo desde otra carpeta y una
// relativa no se encuentra.
const respaldoTv = fileURLToPath(new URL("./scripts/postcss-respaldo-tv.cjs", import.meta.url));

const postcssConfig = {
  plugins: {
    "@tailwindcss/postcss": {},
    "@csstools/postcss-cascade-layers": {},
    [respaldoTv]: {},
  },
};

export default postcssConfig;
