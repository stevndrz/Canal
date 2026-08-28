/**
 * Freno de peticiones por IP, en memoria del proceso.
 *
 * Las dos rutas de API son públicas y llaman a TMDB **con nuestra credencial**.
 * El límite de TMDB se aplica a la credencial, no a quien llama: cualquiera que
 * descubra la URL del despliegue puede quemar la cuota desde su propio
 * front-end, y de paso las invocaciones de función de Vercel. Sin autenticación
 * no hay forma de saber quién fue — se vería en la factura, no en un registro.
 *
 * Sin base de datos, a propósito: un `Map` en memoria es el mismo patrón que ya
 * usan `m3u.ts` y `epg.ts` para cachear. Tiene un límite conocido y conviene
 * decirlo en vez de fingir que no existe: **cada instancia de la función tiene
 * su propio `Map`**, así que con varias instancias el tope efectivo se
 * multiplica por el número de instancias. No es un control de seguridad
 * infalible; es lo que convierte «te vacían la cuota en un bucle» en «te hacen
 * cosquillas». Para algo serio, el WAF de Vercel, que no necesita código.
 */

/** Cuántas peticiones se admiten por IP dentro de la ventana. */
const PETICIONES = 30;
/** Tamaño de la ventana. */
const VENTANA_MS = 60_000;
/**
 * Tope de IPs recordadas a la vez.
 *
 * Sin esto, el propio `Map` sería el agujero: bastaría con falsificar
 * `x-forwarded-for` en cada petición para hacerlo crecer sin fin y agotar la
 * memoria de la función. Al pasarse se vacía entero; perder el conteo un
 * instante es infinitamente mejor que caerse.
 */
const MAX_IPS = 5_000;

/**
 * Tope de peticiones de TODO EL MUNDO dentro de la ventana.
 *
 * El de arriba cuenta por IP, y quien elige su propia IP no tiene tope: basta
 * con mandar un `x-forwarded-for` distinto en cada petición para estrenar
 * ventana cada vez. Fuera de Vercel —`next start` en la red de casa, que es
 * justo como se usa esto— la cabecera la pone quien llama, y no hay forma de
 * saber desde aquí si delante hay un proxy que la reescriba o no.
 *
 * Este contador no pregunta quién llama, así que no se puede falsificar. Es el
 * único freno que sigue en pie cuando la identificación falla.
 *
 * **Lo que cuesta:** es un tope compartido, así que alguien que lo agote deja
 * a los demás fuera hasta que pase el minuto. Se acepta a sabiendas y por eso
 * va holgado —veinte veces el cupo de una IP—: solo salta con un volumen que
 * ninguna casa produce. Perder un minuto de catálogo es mejor que regalar la
 * cuota de TMDB y las invocaciones de la función.
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
 * Quién hace la petición, según las cabeceras que pone la plataforma.
 *
 * **El orden importa, y es el de menos falsificable a más.** Ninguna de estas
 * cabeceras es de fiar por sí sola: son texto que manda quien llama, y solo
 * valen cuando delante hay un proxy que las reescribe.
 *
 * 1. `x-vercel-forwarded-for` la pone la red de Vercel y **descarta** la que
 *    trajera la petición. Es la única que aquí no se puede elegir.
 * 2. `x-real-ip` la escribe el proxy de delante con un valor único: no admite
 *    lista, así que no se le puede anteponer nada.
 * 3. `x-forwarded-for` es una lista a la que cualquiera puede añadir por la
 *    izquierda. Se conserva como último recurso porque sin proxy conocido es
 *    lo único que hay, pero **no se sostiene sola**: el freno que aguanta
 *    cuando esto se falsifica es `TOPE_GLOBAL`, que no pregunta quién llama.
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

  // El tope compartido va PRIMERO y cuenta siempre, incluso las peticiones que
  // el cupo por IP ya iba a rechazar: si solo contara las que pasan, mandar
  // basura desde una sola IP saldría gratis.
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
