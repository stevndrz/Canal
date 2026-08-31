/**
 * Marcar un canal por su número, como en una televisión de siempre.
 *
 * Se acumulan los dígitos y se salta cuando ya no cabe duda, que tiene dos
 * formas: o vence el tiempo, o **ningún número más largo empieza por lo
 * marcado** — y esa segunda es la que hace que teclear un número completo se
 * sienta instantáneo en vez de dejarte dos segundos mirando la pantalla.
 */

/** Tope de dígitos. Los números de esta app llegan a cuatro cifras. */
export const MAX_DIGITOS = 4;

/** Cuánto se espera antes de dar el número por terminado. */
export const ESPERA_MS = 2_000;

/**
 * Índice para resolver un marcado sin recorrer 7.822 canales en cada tecla.
 *
 * Es un **conteo** y no un conjunto porque la pregunta real no es «¿existe algo
 * que empiece así?» sino «¿hay algo MÁS LARGO que empiece así?». Con un
 * conjunto habría que recorrerlo entero, que es lo que el índice viene a
 * evitar; con el conteo sale de restarle el propio marcado si es un número.
 */
export interface IndiceMarcado<T> {
  exactos: Map<string, T>;
  cuantosEmpiezanPor: Map<string, number>;
}

export function indexarParaMarcado<T extends { number: string }>(
  canales: readonly T[],
): IndiceMarcado<T> {
  const exactos = new Map<string, T>();
  const cuantosEmpiezanPor = new Map<string, number>();

  for (const canal of canales) {
    const numero = canal.number;
    if (!numero) continue;
    // El primero gana: si dos canales comparten número, marcarlo lleva al que
    // sale antes en la lista, que es el que se está viendo en pantalla.
    if (!exactos.has(numero)) exactos.set(numero, canal);
    for (let i = 1; i <= numero.length; i++) {
      const prefijo = numero.slice(0, i);
      cuantosEmpiezanPor.set(prefijo, (cuantosEmpiezanPor.get(prefijo) ?? 0) + 1);
    }
  }

  return { exactos, cuantosEmpiezanPor };
}

/** Qué hacer después de añadir un dígito. */
export type Decision =
  /** Puede crecer: se espera a otro dígito o a que venza el tiempo. */
  | { tipo: "seguir" }
  /** No hay duda posible: se salta ya. */
  | { tipo: "saltar" }
  /** Ningún canal empieza así: no hay nada que esperar. */
  | { tipo: "no-existe" };

export function decidir<T>(indice: IndiceMarcado<T>, marcado: string): Decision {
  const cuantos = indice.cuantosEmpiezanPor.get(marcado) ?? 0;
  if (cuantos === 0) return { tipo: "no-existe" };

  const esCanal = indice.exactos.has(marcado);
  /**
   * Cuántos de los que empiezan por esto son más largos.
   *
   * Si el marcado es además un número completo, uno de los que cuenta el índice
   * es él mismo: descontarlo deja exactamente los que podrían seguir creciendo.
   */
  const masLargos = cuantos - (esCanal ? 1 : 0);

  if (esCanal && masLargos === 0) return { tipo: "saltar" };
  return { tipo: "seguir" };
}

/** El canal marcado, o nada si ese número no existe. */
export function canalDeMarcado<T>(indice: IndiceMarcado<T>, marcado: string): T | null {
  return indice.exactos.get(marcado) ?? null;
}

/**
 * Pasado el tope se ignora en vez de reiniciar: quien teclea un dígito de más
 * se ha equivocado, y empezar de cero con él le llevaría a un canal cualquiera.
 */
export function siguienteMarcado(actual: string, digito: string): string | null {
  if (!/^[0-9]$/.test(digito)) return null;
  if (actual.length >= MAX_DIGITOS) return null;
  // Un cero a la izquierda no empieza ningún número de canal.
  if (actual === "" && digito === "0") return null;
  return actual + digito;
}
