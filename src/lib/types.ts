/** Canal tal como sale de la lista M3U, antes de numerarlo y enriquecerlo. */
export interface ParsedChannel {
  name: string;
  category: string;
  /** Monograma de respaldo cuando no hay logo. */
  logoText: string;
  /** "" cuando no se encontró ningún logo: la UI cae al monograma. */
  logoUrl: string;
  streamUrl: string;
  /** "" cuando la lista no trae tvg-id. */
  tvgId: string;
}

/**
 * Canal listo para la UI. No hereda de ParsedChannel a propósito: `tvgId` solo
 * se usa en el servidor para cruzar con el EPG, y con listas de más de 10.000
 * canales cada campo de más se paga en el HTML que descarga el teléfono.
 */
export interface Channel {
  id: number;
  number: string;
  name: string;
  category: string;
  logoText: string;
  logoUrl: string;
  streamUrl: string;
  /** Vacíos cuando no hay guía EPG real: nunca se rellenan con texto inventado. */
  currentProgram: string;
  nextProgram: string;
  isFavorite: boolean;
}
