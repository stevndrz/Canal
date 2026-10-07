/** Junta clases y se salta las vacías: `unir("ui", activo && "is-x", className)`. */
export function unir(...clases: Array<string | false | null | undefined>): string {
  return clases.filter(Boolean).join(" ");
}

/** Tallas de control, de `--control-sm/md/lg` en `shell.css`. */
export type Tamano = "sm" | "md" | "lg";
