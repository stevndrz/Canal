import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * La sala única de la casa: aparatos vinculados con un PIN.
 *
 * Cada aparato se vincula **una vez**: escribe el PIN (`SALA_PIN`) y recibe una
 * llave firmada con `SALA_SECRETO`, que guarda en `localStorage`. Desde ahí,
 * `/api/pusher/auth` solo deja entrar en el canal a quien trae una llave buena.
 *
 * - **El canal no se puede adivinar**: su nombre sale de un HMAC del secreto,
 *   no de nada que se vea. Antes la sala era un código de seis letras que
 *   viajaba por WhatsApp; quien lo supiera, entraba.
 * - **El PIN entra en la firma.** Cambiar `SALA_PIN` o `SALA_SECRETO` en
 *   Vercel invalida todas las llaves y mueve el canal: desvincula a todos de
 *   golpe, sin lista que mantener.
 * - **El nombre del aparato va dentro de la llave firmada.** La sala lo
 *   muestra en la presencia y nadie puede hacerse pasar por otro editándolo.
 */

export const PIN = /^\d{4}$/;
/** Un secreto más corto se adivina por fuerza bruta sin conocer el PIN. */
const LARGO_MINIMO_SECRETO = 32;

export interface Vinculo {
  /** Identificador estable del aparato: el `user_id` de la presencia. */
  id: string;
  nombre: string;
}

export interface ConfigSala {
  pin: string;
  secreto: string;
}

export function salaConfigurada(config: { salaPin: string; salaSecreto: string }): ConfigSala | null {
  if (!PIN.test(config.salaPin) || config.salaSecreto.length < LARGO_MINIMO_SECRETO) return null;
  return { pin: config.salaPin, secreto: config.salaSecreto };
}

/** Clave de firma: cambia si cambia el PIN o el secreto. */
function claveDe({ pin, secreto }: ConfigSala, uso: string): Buffer {
  return createHmac("sha256", secreto).update(`${uso}|${pin}`).digest();
}

/** El canal de presencia de la sala. Solo lo conoce quien tiene llave. */
export function canalDeLaSala(config: ConfigSala): string {
  return `presence-sala-${claveDe(config, "canal").toString("hex").slice(0, 32)}`;
}

/** Comparación de tiempo constante: el tiempo de respuesta no dice cuántas cifras acertaste. */
export function pinCorrecto(config: ConfigSala, intento: string): boolean {
  const a = createHmac("sha256", config.secreto).update(`pin|${intento}`).digest();
  const b = createHmac("sha256", config.secreto).update(`pin|${config.pin}`).digest();
  return timingSafeEqual(a, b);
}

/** Lo que alguien escribe como nombre del aparato → algo presentable, o vacío. */
export function limpiarNombre(crudo: unknown): string {
  if (typeof crudo !== "string") return "";
  // Sin controles ni saltos; 24 caracteres caben en un círculo de presencia.
  return crudo.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);
}

function firmar(config: ConfigSala, carga: string): string {
  return createHmac("sha256", claveDe(config, "llave")).update(carga).digest("base64url");
}

export function emitirLlave(config: ConfigSala, nombre: string): { llave: string; vinculo: Vinculo } {
  const vinculo: Vinculo = { id: randomBytes(9).toString("base64url"), nombre };
  const carga = Buffer.from(JSON.stringify({ v: 1, ...vinculo })).toString("base64url");
  return { llave: `${carga}.${firmar(config, carga)}`, vinculo };
}

/** La llave que trae un aparato → su vínculo, o `null` si no es nuestra. */
export function leerLlave(config: ConfigSala, llave: string | null | undefined): Vinculo | null {
  if (!llave || llave.length > 512) return null;
  const [carga, firma, sobra] = llave.split(".");
  if (!carga || !firma || sobra !== undefined) return null;
  const esperada = Buffer.from(firmar(config, carga));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;
  try {
    const datos = JSON.parse(Buffer.from(carga, "base64url").toString("utf8")) as Record<string, unknown>;
    if (datos.v !== 1 || typeof datos.id !== "string" || typeof datos.nombre !== "string") return null;
    return { id: datos.id, nombre: datos.nombre };
  } catch {
    return null;
  }
}
