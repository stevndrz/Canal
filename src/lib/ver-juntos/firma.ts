import "server-only";
import { createHmac } from "node:crypto";

/**
 * Firma de suscripción a un canal privado de Pusher: HMAC-SHA256 de
 * `socket_id:canal` con el secreto de la app. Son tres líneas, así que no hace
 * falta el SDK de servidor de Pusher solo para esto.
 *
 * Vive fuera de la ruta porque un `route.ts` solo puede exportar los verbos
 * HTTP, y fuera de `sala.ts` porque eso lo importa el navegador.
 */
export function firmarCanal(secreto: string, socketId: string, canal: string): string {
  return createHmac("sha256", secreto).update(`${socketId}:${canal}`).digest("hex");
}

/** Forma del `socket_id` que manda Pusher: siempre «123456.789012». */
export const SOCKET_ID = /^\d{1,20}\.\d{1,20}$/;
