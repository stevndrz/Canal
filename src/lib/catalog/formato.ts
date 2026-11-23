/**
 * Cómo se escriben los números del catálogo: como en Guatemala.
 *
 * En Guatemala (y en México y Centroamérica) el decimal va con punto y los
 * miles con coma: «6.5» y «4,816». Con el «es» genérico salía «6,5», como en
 * España, al lado de «4,816 canales» en la misma pantalla. Todas las cifras
 * de la app usan `es-GT`.
 */
const NOTA = new Intl.NumberFormat("es-GT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** «6.5»: una nota de TMDB (0–10) con un decimal. */
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
