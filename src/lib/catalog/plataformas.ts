/**
 * Las plataformas de «Explorar por plataforma» y el logo del título del
 * héroe. Lógica pura: sin red ni React, para poder probarla.
 */

/**
 * Las que se ofrecen, en este orden, si TMDB dice que existen en Guatemala.
 *
 * Lista cerrada a propósito: `/watch/providers` devuelve más de cien
 * (tiendas de alquiler, canales de nicho, duplicados «con anuncios»), y una
 * fila de cien logos no se recorre con un mando. Los ids son los de TMDB; Max
 * tiene dos (1899 el nuevo y 384 el de HBO Max) según la región.
 */
export const PLATAFORMAS: readonly { id: number; nombre: string }[] = [
  { id: 8, nombre: "Netflix" },
  { id: 119, nombre: "Prime Video" },
  { id: 337, nombre: "Disney+" },
  { id: 1899, nombre: "Max" },
  { id: 384, nombre: "Max" },
  { id: 350, nombre: "Apple TV+" },
  { id: 531, nombre: "Paramount+" },
  { id: 283, nombre: "Crunchyroll" },
  { id: 457, nombre: "ViX" },
];

/** La región para TMDB: los catálogos cambian por país. */
export const REGION_PLATAFORMAS = "GT";

export interface Plataforma {
  id: number;
  nombre: string;
  /** Ruta del logo en TMDB (`/abc.jpg`), sin tamaño. */
  logo: string;
}

/** Lo que devuelve TMDB por cada proveedor. */
export interface ProveedorTmdb {
  provider_id: number;
  provider_name?: string;
  logo_path?: string | null;
}

/**
 * Cruza lo que TMDB tiene en la región con la lista curada: solo las
 * conocidas, en el orden de la lista, sin repetir nombre (si llegan los dos
 * ids de Max, gana el primero).
 */
export function plataformasDeLaRegion(proveedores: readonly ProveedorTmdb[]): Plataforma[] {
  const porId = new Map(proveedores.map((p) => [p.provider_id, p]));
  const vistas = new Set<string>();
  const resultado: Plataforma[] = [];
  for (const { id, nombre } of PLATAFORMAS) {
    const proveedor = porId.get(id);
    if (!proveedor?.logo_path || vistas.has(nombre)) continue;
    vistas.add(nombre);
    resultado.push({ id, nombre, logo: proveedor.logo_path });
  }
  return resultado;
}

/** El id de `?plataforma=` si es uno de los que se ofrecen; si no, `null`. */
export function plataformaValida(valor: string | undefined | null): number | null {
  const id = Number(valor);
  return Number.isInteger(id) && PLATAFORMAS.some((p) => p.id === id) ? id : null;
}

/**
 * El trozo de consulta de `/discover` para filtrar por plataforma: solo por
 * suscripción (`flatrate`) o gratis, no alquiler ni compra — lo que se quiere
 * saber es «qué puedo ver con lo que ya pago».
 */
export function consultaDePlataforma(id: number | null): string {
  if (id === null) return "";
  return `&with_watch_providers=${id}&watch_region=${REGION_PLATAFORMAS}&with_watch_monetization_types=flatrate|free|ads`;
}

/** Un logo de título tal como viene de `/images`. */
export interface LogoTmdb {
  file_path: string;
  iso_639_1?: string | null;
  vote_average?: number;
}

/**
 * El logo del título para el héroe: en español, o sin idioma (los que son
 * solo dibujo). Nunca en otro idioma: un «The Dark Knight» encima de una
 * sinopsis en español se lee como un error. Sin ninguno válido, `null` y el
 * héroe pinta el título en texto, como siempre.
 */
export function elegirLogo(logos: readonly LogoTmdb[] | undefined): string | null {
  if (!logos?.length) return null;
  const mejor = (lista: readonly LogoTmdb[]) =>
    [...lista].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))[0]?.file_path ?? null;
  const enEspanol = logos.filter((l) => l.iso_639_1 === "es");
  if (enEspanol.length) return mejor(enEspanol);
  const sinIdioma = logos.filter((l) => !l.iso_639_1);
  return sinIdioma.length ? mejor(sinIdioma) : null;
}
