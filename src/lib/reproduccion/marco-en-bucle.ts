/**
 * Detectar un embed que se recarga a sí mismo sin parar.
 *
 * El caso real que lo motiva: la cadena de VidSrc mete su reproductor detrás de
 * una comprobación invisible de Cloudflare Turnstile, y **todos** los caminos
 * de fallo de esa comprobación terminan igual:
 *
 *     function tsErr(){ window.location.reload(); }
 *     .catch(function(){ window.location.reload(); });
 *
 * En un navegador que Turnstile no admite —el de un televisor Samsung, por
 * ejemplo— la comprobación nunca pasa, así que el marco se recarga para
 * siempre: rueda de carga, recarga, rueda, recarga. Es literalmente el «se
 * refresca una y otra vez sin cargar» que se reportó.
 *
 * Dos cosas que conviene tener claras:
 *
 * 1. **Esto no se arregla con `sandbox`.** Un iframe sandboxeado puede recargar
 *    su propia `location` sin ningún permiso especial; lo que el sandbox
 *    bloquea es navegar la ventana de ARRIBA. Se intentó, no sirvió, y encima
 *    varios proveedores lo detectaban y se negaban a reproducir. Está
 *    retirado.
 * 2. **Desde fuera no se puede ver nada del iframe… salvo cuántas veces
 *    carga.** El evento `load` del elemento `<iframe>` se dispara en cada
 *    documento que carga el marco, aunque sea de otro dominio. Es la única
 *    señal honesta que hay, y basta: uno normal carga una vez, uno en bucle
 *    dispara ocho veces en cinco segundos (medido).
 *
 * Aquí solo vive la decisión, sin DOM ni React, para poder probarla.
 */

/**
 * Cargas permitidas antes de dar el marco por perdido.
 *
 * Tres, no una: hay embeds que navegan legítimamente un par de veces —el
 * propio Turnstile, cuando SÍ pasa, hace un `location.replace` para añadir su
 * token—. A la cuarta ya no es una redirección, es un bucle.
 */
export const CARGAS_ANTES_DE_RENDIRSE = 3;

/**
 * Ventana en la que se cuentan. Un bucle recarga en cuestión de segundos; si
 * entre dos cargas pasa más que esto, es navegación normal de la persona.
 */
export const VENTANA_BUCLE_MS = 15_000;

/** Lo que se lleva contado de un marco concreto. */
export interface ConteoDeCargas {
  /** Servidor al que pertenece el conteo; cambiar de servidor lo reinicia. */
  servidorId: string;
  veces: number;
  /** Marca de la primera carga de la tanda. */
  desde: number;
}

export type VeredictoDeCarga =
  | { conteo: ConteoDeCargas; enBucle: false }
  | { conteo: ConteoDeCargas; enBucle: true };

/**
 * Registra una carga del marco y dice si ya hay que rendirse con ese servidor.
 *
 * Devuelve el conteo nuevo en vez de mutarlo: así la decisión es una función
 * de sus argumentos y se puede probar entera.
 */
export function registrarCarga(
  previo: ConteoDeCargas | null,
  servidorId: string,
  ahora: number,
): VeredictoDeCarga {
  const esOtraTanda =
    previo === null ||
    previo.servidorId !== servidorId ||
    ahora - previo.desde > VENTANA_BUCLE_MS;

  if (esOtraTanda) {
    return { conteo: { servidorId, veces: 1, desde: ahora }, enBucle: false };
  }

  const conteo = { ...previo, veces: previo.veces + 1 };
  return { conteo, enBucle: conteo.veces > CARGAS_ANTES_DE_RENDIRSE };
}
