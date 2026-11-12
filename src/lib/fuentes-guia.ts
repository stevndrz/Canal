import type { FuenteDeGuia } from "./epg";

/**
 * De dónde salen los horarios de la guía.
 *
 * Hasta noviembre de 2026 solo se usaba la guía que trae la lista M3U
 * (`x-tvg-url`), y la de la lista de la casa cubría **2 canales de 4.922**
 * (Al Jazeera y ANT1), con programas del día anterior. En la práctica no había
 * guía.
 *
 * Ahora se juntan varias, en este orden (en un choque manda la primera):
 * 1. `EPG_URL`, si quien despliega la puso. Admite varias separadas por comas,
 *    y entonces **solo** se usan esas: es una decisión explícita. `no` apaga
 *    la guía del todo (lo usan las pruebas e2e, que no deben salir a internet).
 * 2. La de la lista, por si algún día trae algo.
 * 3. `GUIAS_DE_RESPALDO`: guías públicas por país, elegidas a mano.
 *
 * Las de respaldo cuentan como de quien despliega (`deLaLista: false`): están
 * escritas aquí, no las decide el dueño de una lista ajena.
 */
export const GUIAS_DE_RESPALDO: readonly string[] = [
  /**
   * open-epg.com, Guatemala: 98 canales tal y como se ven aquí (Canal 3,
   * Canal 7, Guatevisión, Azteca, Canal Antigua y el cable: ESPN, CNN en
   * Español, Discovery…), unos dos días por delante. 240 KB comprimida.
   * No trae TN23. Medido el 2026-11-12.
   */
  "https://www.open-epg.com/files/guatemala1.xml.gz",
];

export function fuentesDeGuia(propia: string, deLaLista: string | null): FuenteDeGuia[] {
  if (propia.trim().toLowerCase() === "no") return [];
  const propias = propia
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (propias.length > 0) return propias.map((url) => ({ url, deLaLista: false }));
  const fuentes: FuenteDeGuia[] = [];
  if (deLaLista) fuentes.push({ url: deLaLista, deLaLista: true });
  for (const url of GUIAS_DE_RESPALDO) {
    if (url !== deLaLista) fuentes.push({ url, deLaLista: false });
  }
  return fuentes;
}
