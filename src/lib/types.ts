export interface Channel {
  id: number;
  name: string;
  number: string;
  category: string;
  logoText: string;
  logoUrl: string;
  streamUrl: string;
  tvgId: string;
  // Vacíos cuando no hay guía EPG real disponible: nunca se rellenan con
  // texto de relleno.
  currentProgram: string;
  nextProgram: string;
  isFavorite: boolean;
  isLive: boolean;
}
