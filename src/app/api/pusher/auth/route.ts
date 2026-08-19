import { PUSHER_SOCKET_ID, WATCH_PARTY_CHANNEL, signChannel } from "@/lib/watch-party/sign";

/**
 * Autenticación de canales privados de Pusher.
 *
 * Los canales `private-*` exigen que el servidor firme la suscripción, y eso
 * es justo lo que habilita los *client events*: los mensajes de play/pausa
 * viajan entre navegadores a través de Pusher sin pasar por nuestro servidor,
 * así que no hay coste por evento ni latencia añadida.
 *
 * El `secret` se usa solo aquí: nunca llega al navegador.
 */
export async function POST(request: Request) {
  const appKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;

  if (!appKey || !secret) {
    return Response.json(
      { error: "Watch Party no configurado: faltan las credenciales de Pusher." },
      { status: 503 }
    );
  }

  let socketId: string | null = null;
  let channelName: string | null = null;

  // Pusher envía form-urlencoded por defecto; se admite JSON por si el cliente
  // se configura de otra manera.
  try {
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const body = (await request.json()) as { socket_id?: string; channel_name?: string };
      socketId = body.socket_id ?? null;
      channelName = body.channel_name ?? null;
    } else {
      const form = await request.formData();
      socketId = form.get("socket_id")?.toString() ?? null;
      channelName = form.get("channel_name")?.toString() ?? null;
    }
  } catch {
    return Response.json({ error: "Petición mal formada." }, { status: 400 });
  }

  if (!socketId || !channelName) {
    return Response.json({ error: "Faltan socket_id o channel_name." }, { status: 400 });
  }

  // Solo se firman salas de esta app: sin esta comprobación cualquiera podría
  // pedirnos una firma para un canal privado arbitrario de la cuenta.
  if (!WATCH_PARTY_CHANNEL.test(channelName)) {
    return Response.json({ error: "Canal no permitido." }, { status: 403 });
  }
  if (!PUSHER_SOCKET_ID.test(socketId)) {
    return Response.json({ error: "socket_id inválido." }, { status: 400 });
  }

  return Response.json({ auth: `${appKey}:${signChannel(secret, socketId, channelName)}` });
}
