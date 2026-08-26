/**
 * Qué canales han dejado de responder, y cómo apartarlos.
 *
 * De 7.822 canales de una lista IPTV pública, muchos no responden nunca. El
 * reproductor ya sabe cuándo uno falla —`StreamPlayer` levanta `streamError`—
 * pero ese dato no se guardaba en ningún sitio, así que cada quien tropezaba
 * con los mismos canales muertos una y otra vez.
 *
 * Aquí solo vive la aritmética, sin DOM ni React, para poder probarla.
 *
 * **Se indexa por la URL del stream, no por el `id` del canal.** El id es la
 * posición en la lista (ver `canales-empaquetados.ts`), así que en cuanto la
 * M3U cambie de tamaño un registro viejo estaría apartando un canal que sí
 * funciona. La URL es estable aunque la lista se reordene. Se guarda un hash
 * corto y no la URL entera: solo entran los que fallan, pero con 7.822
 * candidatos conviene que `localStorage` no crezca sin control.
 */

/** Fallos seguidos antes de dar un canal por caído. */
export const FALLOS_PARA_APARTAR = 2;

/** Cuánto se recuerda un canal caído. */
export const OLVIDO_MS = 7 * 24 * 60 * 60 * 1000;

/** Tope de canales recordados. */
export const MAX_RECORDADOS = 400;

/** Lo que se sabe de un canal que ha fallado. */
export interface Caido {
  /** Fallos seguidos. Un éxito lo borra entero. */
  fallos: number;
  /** Cuándo fue el último fallo. */
  visto: number;
}

export type MemoriaCaidos = Record<string, Caido>;

/**
 * Clave corta y estable a partir de la URL.
 *
 * FNV-1a de 32 bits en base 36: seis o siete caracteres por canal. No es
 * criptográfico y no hace falta que lo sea — lo peor que puede pasar con una
 * colisión es que un canal herede la mala fama de otro, y a los siete días se
 * olvida igual.
 */
export function claveDeCanal(streamUrl: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < streamUrl.length; i += 1) {
    hash ^= streamUrl.charCodeAt(i);
    // El equivalente a multiplicar por 16777619 sin salirse de 32 bits.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Un fallo más.
 *
 * **Hacen falta dos seguidos**, no uno: un corte puntual del proveedor, o un
 * segundo malo de wifi, no convierten a un canal en un cadáver.
 */
export function registrarFallo(memoria: MemoriaCaidos, clave: string, ahora: number): MemoriaCaidos {
  const previo = memoria[clave];
  const siguiente: MemoriaCaidos = {
    ...memoria,
    [clave]: { fallos: (previo?.fallos ?? 0) + 1, visto: ahora },
  };
  return podar(siguiente, ahora);
}

/** Se vio: se le borra el historial entero, no se le resta un fallo. */
export function registrarExito(memoria: MemoriaCaidos, clave: string): MemoriaCaidos {
  if (!(clave in memoria)) return memoria;
  const siguiente = { ...memoria };
  delete siguiente[clave];
  return siguiente;
}

/** ¿Está apartado ahora mismo? */
export function estaCaido(memoria: MemoriaCaidos, clave: string, ahora: number): boolean {
  const caido = memoria[clave];
  if (!caido) return false;
  if (ahora - caido.visto > OLVIDO_MS) return false;
  return caido.fallos >= FALLOS_PARA_APARTAR;
}

/**
 * Los sanos delante, los caídos detrás, **sin perder ninguno**.
 *
 * Apartar y no esconder es deliberado: estos canales resucitan continuamente y
 * esconderlos en silencio ya fue un error antes en este proyecto. Quien quiera
 * probar uno lo tiene al final de su lista, con su marca.
 *
 * El orden relativo se conserva dentro de cada grupo, así que la numeración
 * por categorías y el zapeo siguen teniendo sentido.
 */
export function ordenarPorSalud<T extends { streamUrl: string }>(
  canales: T[],
  memoria: MemoriaCaidos,
  ahora: number,
): T[] {
  // Sin nada apuntado no se toca el array: es el caso normal y recorrerlo dos
  // veces para nada, con 7.822 elementos, se nota en un televisor.
  if (Object.keys(memoria).length === 0) return canales;

  const sanos: T[] = [];
  const caidos: T[] = [];
  for (const canal of canales) {
    (estaCaido(memoria, claveDeCanal(canal.streamUrl), ahora) ? caidos : sanos).push(canal);
  }
  return caidos.length === 0 ? canales : [...sanos, ...caidos];
}

/** Fuera lo caducado y, si aun así sobra, lo más viejo. */
function podar(memoria: MemoriaCaidos, ahora: number): MemoriaCaidos {
  const vivos = Object.entries(memoria).filter(([, caido]) => ahora - caido.visto <= OLVIDO_MS);
  if (vivos.length <= MAX_RECORDADOS) return Object.fromEntries(vivos);
  return Object.fromEntries(
    vivos.sort((a, b) => b[1].visto - a[1].visto).slice(0, MAX_RECORDADOS),
  );
}
