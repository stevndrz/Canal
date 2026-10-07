/**
 * Cómo se escriben los números del catálogo, en español.
 *
 * `toFixed(1)` da «6.5», con punto: así se escribe en inglés. En Guatemala, en
 * México y en España se escribe «6,5», y una nota con punto es de esos
 * detalles que hacen que la app parezca traducida en vez de hecha aquí.
 */
const NOTA = new Intl.NumberFormat("es", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** «6,5»: una nota de TMDB (0–10) con un decimal y coma. */
export function formatearNota(nota: number): string {
  return NOTA.format(nota);
}

/** «2 h 5 min», que es como se dice una duración, y no «125». */
export function formatearDuracion(minutos: number | null | undefined): string | null {
  if (!minutos || minutos <= 0) return null;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}
