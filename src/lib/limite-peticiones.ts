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

interface Ventana {
  contador: number;
  hasta: number;
}

const visto = new Map<string, Ventana>();

/**
 * Quién hace la petición, según las cabeceras que pone la plataforma.
 *
 * `x-forwarded-for` se puede falsificar, pero en Vercel la cabecera la
 * **reescribe el proxy** antes de llegar aquí, así que el primer valor es real.
 * Fuera de Vercel esto degrada a un agrupador aproximado, que sigue sirviendo
 * para lo que se busca.
 */
export function identificarCliente(request: Request): string {
  const reenviado = request.headers.get("x-forwarded-for");
  if (reenviado) return reenviado.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "desconocido";
}

/**
 * `true` si esta petición se pasa del cupo.
 *
 * `ahora` se inyecta para poder probar la ventana sin esperar un minuto.
 */
export function excedeLimite(clave: string, ahora: number = Date.now()): boolean {
  if (visto.size > MAX_IPS) visto.clear();

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
}

export const LIMITES = { PETICIONES, VENTANA_MS, MAX_IPS } as const;
