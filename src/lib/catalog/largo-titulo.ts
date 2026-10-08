/**
 * Cuánto mide el título, en cuatro tallas que la hoja convierte en tamaño de
 * letra. Por caracteres y no midiendo el texto en pantalla: así sale bien en
 * el primer fotograma, sin saltos y sin JavaScript en el cliente. «Overflow»
 * llena la portada; «La noche del demonio: Están entre nosotros» cabe en dos
 * líneas en vez de tres.
 */
export function largoDeTitulo(titulo: string): "xs" | "corto" | "medio" | "largo" {
  const n = titulo.trim().length;
  if (n <= 10) return "xs";
  if (n <= 18) return "corto";
  if (n <= 32) return "medio";
  return "largo";
}
