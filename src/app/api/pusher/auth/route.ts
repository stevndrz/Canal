import { publicConfig } from "@/lib/config";
import { serverConfig } from "@/lib/config.server";
import { excedeLimite, identificarCliente, respuestaLimite } from "@/lib/limite-peticiones";
import { SOCKET_ID, firmarCanal } from "@/lib/ver-juntos/firma";
import { CANAL_DE_SALA } from "@/lib/ver-juntos/sala";

/**
 * Firma de las salas de «Ver juntos».
 *
 * Pusher exige que el servidor firme la entrada a un canal `private-*`, y es
 * justo lo que habilita los *client events*: el play y la pausa viajan de
 * aparato a aparato por Pusher **sin pasar por aquí**. Esta ruta se llama una
 * vez por persona al entrar en la sala, nada más.
 *
 * Recuperada del Watch Party que se retiró en agosto, con dos cambios: el
 * freno de peticiones que tienen las demás rutas, y que solo firma canales con
 * la forma exacta de un código de sala (`CANAL_DE_SALA`), no cualquier nombre.
 */
export async function POST(request: Request) {
  if (excedeLimite(identificarCliente(request))) return respuestaLimite();

  const clave = publicConfig.pusherKey;
  const secreto = serverConfig().pusherSecreto;
  if (!clave || !secreto) {
    return Response.json(
      { error: "Ver juntos no está configurado: faltan las credenciales de Pusher." },
      { status: 503 },
    );
  }

  // Pusher manda form-urlencoded; se admite JSON por si algún día se cambia.
  let socketId = "";
  let canal = "";
  try {
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const cuerpo = (await request.json()) as { socket_id?: unknown; channel_name?: unknown };
      socketId = String(cuerpo.socket_id ?? "");
      canal = String(cuerpo.channel_name ?? "");
    } else {
      const formulario = await request.formData();
      socketId = String(formulario.get("socket_id") ?? "");
      canal = String(formulario.get("channel_name") ?? "");
    }
  } catch {
    return Response.json({ error: "Petición mal formada." }, { status: 400 });
  }

  if (!SOCKET_ID.test(socketId)) {
    return Response.json({ error: "socket_id inválido." }, { status: 400 });
  }
  // Sin esto, cualquiera podría pedirnos la firma de un canal privado
  // arbitrario de la misma cuenta de Pusher.
  if (!CANAL_DE_SALA.test(canal)) {
    return Response.json({ error: "Canal no permitido." }, { status: 403 });
  }

  return Response.json(
    { auth: `${clave}:${firmarCanal(secreto, socketId, canal)}` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
