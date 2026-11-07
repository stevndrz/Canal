import { publicConfig } from "@/lib/config";
import { serverConfig } from "@/lib/config.server";
import { excedeLimite, identificarCliente, respuestaLimite } from "@/lib/limite-peticiones";
import { SOCKET_ID, firmarCanal } from "@/lib/ver-juntos/firma";
import { CABECERA_LLAVE } from "@/lib/ver-juntos/sala";
import { canalDeLaSala, leerLlave, salaConfigurada } from "@/lib/ver-juntos/vinculo";

/**
 * Firma de la sala de «Ver juntos».
 *
 * Pusher exige que el servidor firme la entrada a un canal `presence-*`, y es
 * justo lo que habilita los *client events*: el play y la pausa viajan de
 * aparato a aparato por Pusher **sin pasar por aquí**. Esta ruta se llama una
 * vez por aparato al entrar en la sala, nada más.
 *
 * Solo firma **un** canal —el de la sala, derivado del secreto— y solo a quien
 * trae una llave de `/api/sala/vincular`. El nombre que verá el otro en la
 * presencia sale de esa llave firmada, no de lo que mande el navegador.
 */
export async function POST(request: Request) {
  if (excedeLimite(identificarCliente(request))) return respuestaLimite();

  const clave = publicConfig.pusherKey;
  const secreto = serverConfig().pusherSecreto;
  const sala = salaConfigurada(serverConfig());
  if (!clave || !secreto || !sala) {
    return Response.json({ error: "Ver juntos no está configurado." }, { status: 503 });
  }

  const vinculo = leerLlave(sala, request.headers.get(CABECERA_LLAVE));
  if (!vinculo) {
    return Response.json({ error: "Este aparato no está vinculado a la sala." }, { status: 403 });
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
  if (canal !== canalDeLaSala(sala)) {
    return Response.json({ error: "Canal no permitido." }, { status: 403 });
  }

  const datosCanal = JSON.stringify({ user_id: vinculo.id, user_info: { nombre: vinculo.nombre } });
  return Response.json(
    { auth: `${clave}:${firmarCanal(secreto, socketId, canal, datosCanal)}`, channel_data: datosCanal },
    { headers: { "Cache-Control": "no-store" } },
  );
}
