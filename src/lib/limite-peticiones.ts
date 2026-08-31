/**
 * Freno de peticiones, en memoria del proceso.
 *
 * Las rutas de API son públicas y llaman a TMDB **con nuestra credencial**, y
 * el límite de TMDB va contra la credencial, no contra quien llama: sin freno,
 * cualquiera que descubra la URL del despliegue quema la cuota y de paso las
 * invocaciones de Vercel.
 *
 * Su límite conviene decirlo en vez de fingir que no existe: **cada instancia
 * tiene su propio `Map`**, así que el tope efectivo se multiplica por el número
 * de instancias. No es un control infalible; convierte «te vacían la cuota en
 * un bucle» en «te hacen cosquillas». Para algo serio, el WAF de Vercel.
 */

/** Cuántas peticiones se admiten por IP dentro de la ventana. */
const PETICIONES = 30;
/** Tamaño de la ventana. */
const VENTANA_MS = 60_000;
/**
 * Sin esto el propio `Map` sería el agujero: falsificar `x-forwarded-for` en
 * cada petición lo haría crecer sin fin. Al pasarse se vacía entero; perder el
 * conteo un instante es mejor que caerse.
 */
const MAX_IPS = 5_000;

/**
 * Tope de TODO EL MUNDO dentro de la ventana.
 *
 * El de arriba cuenta por IP, y quien elige su propia IP no tiene tope: un
 * `x-forwarded-for` distinto en cada petición estrena ventana cada vez. Fuera
 * de Vercel —`next start` en la red de casa— la cabecera la pone quien llama.
 * Este contador no pregunta quién llama, así que no se puede falsificar.
 *
 * **Lo que cuesta:** es compartido, así que quien lo agote deja fuera a los
 * demás hasta que pase el minuto. Por eso va holgado: solo salta con un volumen
 * que ninguna casa produce.
 */
const TOPE_GLOBAL = PETICIONES * 20;

interface Ventana {
  contador: number;
  hasta: number;
}

const visto = new Map<string, Ventana>();

/** La cuenta que no depende de quién llame. Ver `TOPE_GLOBAL`. */
const compartida: Ventana = { contador: 0, hasta: 0 };

/**
 * Quién llama, de menos falsificable a más. Ninguna es de fiar por sí sola:
 * `x-vercel-forwarded-for` la pone Vercel descartando la que trajera la
 * petición, `x-real-ip` no admite lista donde colarse, y `x-forwarded-for`
 * cualquiera la puede extender por la izquierda — se conserva como último
 * recurso, sostenida por `TOPE_GLOBAL`, que no pregunta quién llama.
 */
export function identificarCliente(request: Request): string {
  const deVercel = request.headers.get("x-vercel-forwarded-for");
  if (deVercel) return deVercel.split(",")[0]!.trim();

  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();

  const reenviado = request.headers.get("x-forwarded-for");
  if (reenviado) return reenviado.split(",")[0]!.trim();

  return "desconocido";
}

/**
 * `true` si esta petición se pasa del cupo.
 *
 * `ahora` se inyecta para poder probar la ventana sin esperar un minuto.
 */
export function excedeLimite(clave: string, ahora: number = Date.now()): boolean {
  if (visto.size > MAX_IPS) visto.clear();

  // Cuenta siempre, incluso lo que el cupo por IP ya iba a rechazar: si solo
  // contara lo que pasa, machacar desde una sola IP saldría gratis.
  if (ahora > compartida.hasta) {
    compartida.contador = 1;
    compartida.hasta = ahora + VENTANA_MS;
  } else {
    compartida.contador += 1;
    if (compartida.contador > TOPE_GLOBAL) return true;
  }

  const ventana = visto.get(clave);
  if (!ventana || ahora > ventana.hasta) {
    visto.set(clave, { contador: 1, hasta: ahora + VENTANA_MS });
    return false;
  }

  ventana.contador += 1;
  return ventana.contador > PETICIONES;
}

/** La respuesta estándar al pasarse, con el `Retry-After` que toca. */
export function respuestaLimite(): Response {
  return Response.json(
    { error: "Demasiadas peticiones. Espera un momento." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil(VENTANA_MS / 1000)),
        "Cache-Control": "no-store",
      },
    },
  );
}

/** Solo para las pruebas: deja el contador a cero entre casos. */
export function olvidarTodo(): void {
  visto.clear();
  compartida.contador = 0;
  compartida.hasta = 0;
}

export const LIMITES = { PETICIONES, VENTANA_MS, MAX_IPS, TOPE_GLOBAL } as const;
