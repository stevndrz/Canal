/**
 * Tope de intentos de PIN, en memoria del proceso.
 *
 * Un PIN de cuatro cifras son 10.000 posibilidades: sin tope, un bucle lo saca
 * en minutos. Con este, cinco fallos por IP cada cuarto de hora y cuarenta en
 * total —para quien cambie de IP en cada intento—, probarlos todos llevaría
 * semanas. Tiene el mismo límite que `limite-peticiones.ts`: cada instancia de
 * Vercel cuenta por su lado. El cierre de verdad es la regla de rate limiting
 * de Vercel sobre `/api/*` (pendiente de activar).
 *
 * El tope total, al agotarse, deja sin vincular también a la familia durante
 * ese cuarto de hora. Se acepta: vincular es cosa de una vez por aparato.
 */

const VENTANA_MS = 15 * 60_000;
export const FALLOS_POR_IP = 5;
const FALLOS_TOTALES = 40;
const MAX_IPS = 5_000;

interface Cuenta {
  fallos: number;
  hasta: number;
}

const porIp = new Map<string, Cuenta>();
let total: Cuenta = { fallos: 0, hasta: 0 };

function vigente(cuenta: Cuenta | undefined, ahora: number): Cuenta {
  return cuenta && ahora < cuenta.hasta ? cuenta : { fallos: 0, hasta: ahora + VENTANA_MS };
}

/** ¿Puede probar? Y si no, cuántos segundos le quedan de espera. */
export function puedeIntentar(ip: string, ahora = Date.now()): { si: true } | { si: false; esperaS: number } {
  const suya = vigente(porIp.get(ip), ahora);
  total = vigente(total, ahora);
  const bloqueo = suya.fallos >= FALLOS_POR_IP ? suya : total.fallos >= FALLOS_TOTALES ? total : null;
  if (!bloqueo) return { si: true };
  return { si: false, esperaS: Math.ceil((bloqueo.hasta - ahora) / 1000) };
}

/** Apunta un fallo. Devuelve cuántos intentos le quedan a esa IP. */
export function apuntarFallo(ip: string, ahora = Date.now()): number {
  if (porIp.size > MAX_IPS) porIp.clear();
  const suya = vigente(porIp.get(ip), ahora);
  suya.fallos++;
  porIp.set(ip, suya);
  total = vigente(total, ahora);
  total.fallos++;
  return Math.max(0, FALLOS_POR_IP - suya.fallos);
}

/** Acertar borra los fallos de esa IP (no los totales: no se puede «lavar» el tope). */
export function apuntarAcierto(ip: string): void {
  porIp.delete(ip);
}

/** Solo para las pruebas. */
export function reiniciarIntentos(): void {
  porIp.clear();
  total = { fallos: 0, hasta: 0 };
}
