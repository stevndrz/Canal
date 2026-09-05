/**
 * Pasar solo al siguiente canal cuando el sintonizado no da imagen.
 *
 * Con 7.822 canales de una lista IPTV pública, que uno esté muerto no es la
 * excepción: es el día a día. Hasta ahora eso terminaba en el cartel «Sin
 * señal» y en tener que elegir otro a mano, uno por uno, hasta acertar.
 *
 * El orden de reintentos es de más barato a más caro, y **cambiar de canal es
 * lo último**:
 *
 * 1. La segunda URL del mismo canal (`streamUrlBackup`), que la lista trae
 *    cuando la misma señal viene repetida. Eso ya lo hacía `StreamPlayer`, y
 *    es lo mejor que puede pasar: sigues viendo lo que pediste.
 * 2. Solo si esa también falla, el siguiente canal de la lista que estés
 *    mirando.
 *
 * Tres reglas que este módulo existe para garantizar, porque las tres son
 * formas de que la función se vuelva insoportable:
 *
 * - **No repetir.** Un canal ya probado en esta cadena no se vuelve a
 *   intentar, o dos canales muertos seguidos se rebotarían el uno al otro
 *   para siempre.
 * - **No recorrer el cementerio.** Los que la memoria de caídos ya tiene
 *   apartados se saltan sin probarlos. Ver `canales-caidos.ts`.
 * - **Rendirse.** Con un tope de saltos: si la categoría entera está muerta,
 *   hay que parar y decirlo, no zapear cien canales delante de alguien.
 *
 * Sin React ni relojes para poder probarlo: `vitest` corre en `node`.
 */

/** Lo poco que hace falta saber de un canal para decidir el salto. */
export interface Candidato {
  id: number;
  streamUrl: string;
}

/**
 * Cuánto se espera a que aparezca la primera imagen antes de dar el canal por
 * muerto.
 *
 * Es el número que hace falta y que no existía. `StreamPlayer` solo se enteraba
 * de un fallo cuando el motor declaraba un error fatal, y **el modo de fallo
 * más común de una lista IPTV no es ese**: es el canal que acepta la conexión
 * y luego no manda nada. Sin error no había nada que contar, así que la ruedita
 * se quedaba girando indefinidamente y ni siquiera se apuntaba como caído.
 *
 * Doce segundos: un televisor lento con una señal buena arranca de sobra
 * dentro de ese margen —de ahí sale el mismo número en `ficha-reproductor.tsx`
 * para los servidores de vídeo—, y pasado eso ya no está cargando, está
 * colgado.
 */
export const ESPERA_SIN_IMAGEN_MS = 12_000;

/**
 * Cuántos canales se prueban antes de rendirse.
 *
 * Cinco y no cincuenta: cada salto es un cambio de imagen delante de alguien,
 * y una cadena larga se ve como una app fuera de control, no como una que
 * ayuda. Si cinco seguidos no dan señal, el problema no es el canal — es la
 * lista, la conexión o la categoría entera, y eso hay que decirlo en vez de
 * seguir buscando.
 */
export const MAX_SALTOS = 5;

/**
 * El siguiente canal que merece la pena probar, o `null` para rendirse.
 *
 * `descartados` son los ya probados en ESTA cadena de fallos, no un historial:
 * lo vacía quien sintoniza a mano y quien consigue imagen. Sin eso, el tope de
 * saltos se agotaría con los fallos de ayer.
 */
export function siguienteCandidato<T extends Candidato>({
  lista,
  actualId,
  descartados,
  estaApartado,
}: {
  /** La lista que se está mirando: la categoría o la búsqueda, no las 7.822. */
  lista: readonly T[];
  actualId: number;
  /** Ids ya probados en esta cadena, el actual incluido. */
  descartados: ReadonlySet<number>;
  /** Si la memoria de caídos ya tiene apartado este canal. */
  estaApartado: (canal: T) => boolean;
}): T | null {
  if (lista.length === 0) return null;
  if (descartados.size >= MAX_SALTOS) return null;

  const desde = lista.findIndex((canal) => canal.id === actualId);
  // Un canal que no está en la lista visible —se filtró mientras fallaba— no
  // deja punto de partida. Empezar por el principio sería saltar a otra parte
  // de la parrilla sin avisar, así que aquí no se salta.
  if (desde < 0) return null;

  /**
   * Dos vueltas, y no una: en la primera se buscan canales sanos, y solo si no
   * hay ninguno se aceptan los apartados. Un canal apartado hace días puede
   * haber vuelto —la lista los resucita continuamente, que es justo la razón
   * por la que `canales-caidos.ts` no los esconde— así que probar uno es mejor
   * que rendirse sin intentarlo.
   */
  for (const soloSanos of [true, false]) {
    for (let paso = 1; paso <= lista.length; paso++) {
      const candidato = lista[(desde + paso) % lista.length];
      if (!candidato || candidato.id === actualId) continue;
      if (descartados.has(candidato.id)) continue;
      if (soloSanos && estaApartado(candidato)) continue;
      return candidato;
    }
  }

  return null;
}
