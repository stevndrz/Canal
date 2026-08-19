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

/** Canal listo para la UI. */
export interface Channel extends ParsedChannel {
  id: number;
  number: string;
  /** Vacíos cuando no hay guía EPG real: nunca se rellenan con texto inventado. */
  currentProgram: string;
  nextProgram: string;
  isFavorite: boolean;
}
