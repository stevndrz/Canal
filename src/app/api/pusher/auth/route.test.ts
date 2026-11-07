import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** La ruta que firma la entrada a la sala de «Ver juntos». */
vi.mock("@/lib/config", () => ({ publicConfig: { pusherKey: "clave-publica" } }));
const SALA = { salaPin: "4821", salaSecreto: "s".repeat(40) };
const secreto = { valor: "secreto-de-prueba" };
vi.mock("@/lib/config.server", () => ({ serverConfig: () => ({ pusherSecreto: secreto.valor, ...SALA }) }));

const { POST } = await import("./route");
const { olvidarTodo } = await import("@/lib/limite-peticiones");
const { firmarCanal } = await import("@/lib/ver-juntos/firma");
const { canalDeLaSala, emitirLlave } = await import("@/lib/ver-juntos/vinculo");

const config = { pin: SALA.salaPin, secreto: SALA.salaSecreto };
const CANAL = canalDeLaSala(config);
const { llave, vinculo } = emitirLlave(config, "Tele sala");

function pedir(campos: Record<string, string>, conLlave: string | null = llave): Request {
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (conLlave) headers["x-sala-llave"] = conLlave;
  return new Request("http://localhost/api/pusher/auth", {
    method: "POST",
    headers,
    body: new URLSearchParams(campos).toString(),
  });
}

describe("/api/pusher/auth", () => {
  beforeEach(() => olvidarTodo());
  afterEach(() => {
    secreto.valor = "secreto-de-prueba";
  });

  it("firma la sala con presencia: «clave:firma» y quién eres, sacado de la llave", async () => {
    const respuesta = await POST(pedir({ socket_id: "123.456", channel_name: CANAL }));
    expect(respuesta.status).toBe(200);
    const cuerpo = (await respuesta.json()) as { auth: string; channel_data: string };
    expect(JSON.parse(cuerpo.channel_data)).toEqual({ user_id: vinculo.id, user_info: { nombre: "Tele sala" } });
    expect(cuerpo.auth).toBe(
      `clave-publica:${firmarCanal("secreto-de-prueba", "123.456", CANAL, cuerpo.channel_data)}`,
    );
  });

  it("sin llave, o con una falsa, no firma", async () => {
    expect((await POST(pedir({ socket_id: "123.456", channel_name: CANAL }, null))).status).toBe(403);
    expect((await POST(pedir({ socket_id: "123.456", channel_name: CANAL }, `${llave}x`))).status).toBe(403);
  });

  it("solo firma el canal de la sala", async () => {
    expect((await POST(pedir({ socket_id: "123.456", channel_name: "private-admin" }))).status).toBe(403);
    expect((await POST(pedir({ socket_id: "123.456", channel_name: "presence-sala-" + "0".repeat(32) }))).status).toBe(403);
  });

  it("rechaza un socket_id raro", async () => {
    expect((await POST(pedir({ socket_id: "abc", channel_name: CANAL }))).status).toBe(400);
  });

  it("dice que no está configurada en vez de firmar con nada", async () => {
    secreto.valor = "";
    expect((await POST(pedir({ socket_id: "123.456", channel_name: CANAL }))).status).toBe(503);
  });
});
