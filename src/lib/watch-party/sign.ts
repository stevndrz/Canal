import { createHmac } from "node:crypto";

/**
 * Firma de suscripción a un canal privado de Pusher: HMAC-SHA256 de
 * `socket_id:canal`. Son cuatro líneas, así que no hace falta instalar el SDK
 * de servidor de Pusher solo para esto.
 *
 * Vive en su propio módulo (y no dentro del route handler) porque Next.js solo
 * permite exportar los verbos HTTP desde un `route.ts`.
 */
export function signChannel(secret: string, socketId: string, channelName: string): string {
  return createHmac("sha256", secret).update(`${socketId}:${channelName}`).digest("hex");
}

/** Nombre de sala admitido: letras, números y guiones. */
export const WATCH_PARTY_CHANNEL = /^private-watch-[a-z0-9-]{1,64}$/i;

/** Formato del socket_id que envía Pusher, siempre "123456.789012". */
export const PUSHER_SOCKET_ID = /^\d+\.\d+$/;

/** Normaliza lo que escribe el usuario a un nombre de sala seguro. */
export function normalizeRoomId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
