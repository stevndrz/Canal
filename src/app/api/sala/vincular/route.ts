import { serverConfig } from "@/lib/config.server";
import { excedeLimite, identificarCliente, respuestaLimite } from "@/lib/limite-peticiones";
import { apuntarAcierto, apuntarFallo, puedeIntentar } from "@/lib/ver-juntos/intentos-pin";
import { PIN, canalDeLaSala, emitirLlave, limpiarNombre, pinCorrecto, salaConfigurada } from "@/lib/ver-juntos/vinculo";

/**
 * Vincular un aparato a la sala: PIN + nombre → llave firmada.
 *
 * Se llama una vez por aparato. La llave se guarda en el navegador y es lo que
 * `/api/pusher/auth` pide para dejar entrar. Ver `lib/ver-juntos/vinculo.ts`.
 */
export async function POST(request: Request) {
  const ip = identificarCliente(request);
  if (excedeLimite(ip)) return respuestaLimite();

  const config = salaConfigurada(serverConfig());
  if (!config) {
    return Response.json(
      { error: "La sala no está configurada: faltan SALA_PIN (4 cifras) y SALA_SECRETO en Vercel." },
      { status: 503 },
    );
  }

  const permiso = puedeIntentar(ip);
  if (!permiso.si) {
    const minutos = Math.max(1, Math.ceil(permiso.esperaS / 60));
    return Response.json(
      { error: `Demasiados intentos. Prueba otra vez en ${minutos} min.` },
      { status: 429, headers: { "Retry-After": String(permiso.esperaS) } },
    );
  }

  let pin = "";
  let nombre = "";
  try {
    const cuerpo = (await request.json()) as { pin?: unknown; nombre?: unknown };
    pin = typeof cuerpo.pin === "string" ? cuerpo.pin : "";
    nombre = limpiarNombre(cuerpo.nombre);
  } catch {
    return Response.json({ error: "Petición mal formada." }, { status: 400 });
  }
  if (!nombre) return Response.json({ error: "Ponle un nombre a este aparato." }, { status: 400 });

  if (!PIN.test(pin) || !pinCorrecto(config, pin)) {
    const quedan = apuntarFallo(ip);
    return Response.json(
      { error: quedan > 0 ? `PIN incorrecto. Te quedan ${quedan} intentos.` : "PIN incorrecto. Espera un rato." },
      { status: 401 },
    );
  }
  apuntarAcierto(ip);

  const { llave, vinculo } = emitirLlave(config, nombre);
  return Response.json(
    { llave, canal: canalDeLaSala(config), ...vinculo },
    { headers: { "Cache-Control": "no-store" } },
  );
}
