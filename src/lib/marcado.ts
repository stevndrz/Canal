/**
 * Marcar un canal por su número, como en una televisión de siempre.
 *
 * Antes los dígitos del mando saltaban a la centena de una categoría: pulsar
 * «3» llevaba al primer canal cuyo número empezara por 3. Eso no es lo que hace
 * un mando de verdad y no coincide con lo que la app enseña — cada fila tiene
 * su número escrito al lado, y teclearlo no llevaba ahí.
 *
 * Lo que hace un televisor: acumula los dígitos, los enseña mientras se marcan,
 * y salta cuando ya no cabe duda. «Cuando ya no cabe duda» tiene dos formas, y
 * las dos importan:
 *
 * - **Se acabó el tiempo.** Se marca «3», se espera, y va al canal 3 si existe.
 * - **No hay continuación posible.** Se marca «307» y ningún canal empieza por
 *   «307» salvo el 307 mismo: no hay nada que esperar, se salta ya. Es lo que
 *   hace que marcar un número completo se sienta instantáneo en vez de dejarte
 *   dos segundos mirando la pantalla.
 */

/** Tope de dígitos. Los números de esta app llegan a cuatro cifras. */
export const MAX_DIGITOS = 4;

/** Cuánto se espera antes de dar el número por terminado. */
export const ESPERA_MS = 2_000;

/**
 * Índice para resolver un marcado sin recorrer la lista en cada tecla.
 *
 * `cuantosEmpiezanPor` cuenta, para cada comienzo posible, cuántos números lo
 * tienen (para el 307 se apuntan «3», «30» y «307»). Con 7.822 canales de
 * cuatro cifras son unas 31.000 entradas, construidas una sola vez.
 *
 * Es un **conteo** y no un conjunto porque la pregunta que hay que responder en
 * cada pulsación no es «¿existe algo que empiece así?» sino «¿hay algo MÁS
 * LARGO que empiece así?», y eso sale de comparar el conteo del prefijo con si
 * el prefijo es además un número completo. Con un conjunto habría que recorrerlo
 * entero para averiguarlo, que es justo lo que este índice viene a evitar.
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
 * El siguiente marcado al pulsar un dígito, o `null` si hay que ignorarlo.
 *
 * Se ignora pasado el tope en vez de reiniciar: quien teclea un dígito de más
 * se ha equivocado, y empezar de cero con ese dígito suelto le llevaría a un
 * canal cualquiera. Dejarlo quieto le da ocasión de ver el número y esperar.
 */
export function siguienteMarcado(actual: string, digito: string): string | null {
  if (!/^[0-9]$/.test(digito)) return null;
  if (actual.length >= MAX_DIGITOS) return null;
  // Un cero a la izquierda no empieza ningún número de canal.
  if (actual === "" && digito === "0") return null;
  return actual + digito;
}
