import { publicConfig } from "@/lib/config";
import { serverConfig } from "@/lib/config.server";
import { excedeLimite, identificarCliente, respuestaLimite } from "@/lib/limite-peticiones";
import { SOCKET_ID, firmarCanal } from "@/lib/ver-juntos/firma";
import { CANAL_DE_SALA, ID_APARATO, limpiarNombre } from "@/lib/ver-juntos/sala";

/**
 * Firma de las salas de «Ver juntos».
 *
 * Pusher exige que el servidor firme la entrada a un canal `presence-*`, y es
 * justo lo que habilita los *client events*: el play y la pausa viajan de
 * aparato a aparato por Pusher **sin pasar por aquí**. Esta ruta se llama una
 * vez por aparato al entrar en la sala, nada más.
 *
 * Solo firma canales con la forma exacta de una sala (`CANAL_DE_SALA`, cuatro
 * cifras), con un freno de peticiones propio, separado del de las demás rutas. Quién eres —id y
 * alias— lo dice el propio aparato: no hay cuentas, y se comprueba a ojo en
 * la presencia («Steven» y «Tele sala» se ven el uno al otro).
 */
export async function POST(request: Request) {
  // Cupo propio: las carátulas y el buscador no pueden dejar a nadie fuera.
  if (excedeLimite(identificarCliente(request), Date.now(), "sala")) return respuestaLimite();

  const clave = publicConfig.pusherKey;
  const secreto = serverConfig().pusherSecreto;
  if (!clave || !secreto) {
    return Response.json(
      { error: "Ver juntos no está configurado: faltan las credenciales de Pusher." },
      { status: 503 },
    );
  }

  // Pusher manda form-urlencoded, con los `params` del cliente al lado.
  let campos: Record<string, string> = {};
  try {
    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      const cuerpo = (await request.json()) as Record<string, unknown>;
      campos = Object.fromEntries(Object.entries(cuerpo).map(([k, v]) => [k, String(v ?? "")]));
    } else {
      const formulario = await request.formData();
      campos = Object.fromEntries([...formulario.entries()].map(([k, v]) => [k, String(v)]));
    }
  } catch {
    return Response.json({ error: "Petición mal formada." }, { status: 400 });
  }

  const socketId = campos.socket_id ?? "";
  const canal = campos.channel_name ?? "";
  if (!SOCKET_ID.test(socketId)) {
    return Response.json({ error: "socket_id inválido." }, { status: 400 });
  }
  // Sin esto, cualquiera podría pedirnos la firma de un canal arbitrario de
  // la misma cuenta de Pusher.
  if (!CANAL_DE_SALA.test(canal)) {
    return Response.json({ error: "Canal no permitido." }, { status: 403 });
  }
  const id = campos.id ?? "";
  const nombre = limpiarNombre(campos.nombre) || "Alguien";
  if (!ID_APARATO.test(id)) {
    return Response.json({ error: "Falta el id del aparato." }, { status: 400 });
  }

  const datosCanal = JSON.stringify({ user_id: id, user_info: { nombre } });
  return Response.json(
    { auth: `${clave}:${firmarCanal(secreto, socketId, canal, datosCanal)}`, channel_data: datosCanal },
    { headers: { "Cache-Control": "no-store" } },
  );
}
