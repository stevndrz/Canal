import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** La ruta que firma la entrada a una sala de «Ver juntos». */
vi.mock("@/lib/config", () => ({ publicConfig: { pusherKey: "clave-publica" } }));
const secreto = { valor: "secreto-de-prueba" };
vi.mock("@/lib/config.server", () => ({ serverConfig: () => ({ pusherSecreto: secreto.valor }) }));

const { POST } = await import("./route");
const { olvidarTodo } = await import("@/lib/limite-peticiones");
const { firmarCanal } = await import("@/lib/ver-juntos/firma");

function pedir(campos: Record<string, string>): Request {
  return new Request("http://localhost/api/pusher/auth", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(campos).toString(),
  });
}

describe("/api/pusher/auth", () => {
  beforeEach(() => olvidarTodo());
  afterEach(() => {
    secreto.valor = "secreto-de-prueba";
  });

  it("firma una sala con la forma de Pusher «clave:firma»", async () => {
    const respuesta = await POST(pedir({ socket_id: "123.456", channel_name: "private-juntos-k7m2qx" }));
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({
      auth: `clave-publica:${firmarCanal("secreto-de-prueba", "123.456", "private-juntos-k7m2qx")}`,
    });
  });

  it("no firma canales que no son salas", async () => {
    const respuesta = await POST(pedir({ socket_id: "123.456", channel_name: "private-admin" }));
    expect(respuesta.status).toBe(403);
  });

  it("rechaza un socket_id raro", async () => {
    const respuesta = await POST(pedir({ socket_id: "abc", channel_name: "private-juntos-k7m2qx" }));
    expect(respuesta.status).toBe(400);
  });

  it("dice que no está configurada en vez de firmar con nada", async () => {
    secreto.valor = "";
    const respuesta = await POST(pedir({ socket_id: "123.456", channel_name: "private-juntos-k7m2qx" }));
    expect(respuesta.status).toBe(503);
  });
});
