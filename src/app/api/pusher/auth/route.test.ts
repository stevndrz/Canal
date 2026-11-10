import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** La ruta que firma la entrada a una sala de «Ver juntos». */
vi.mock("@/lib/config", () => ({ publicConfig: { pusherKey: "clave-publica" } }));
const secreto = { valor: "secreto-de-prueba" };
vi.mock("@/lib/config.server", () => ({ serverConfig: () => ({ pusherSecreto: secreto.valor }) }));

const { POST } = await import("./route");
const { LIMITES, excedeLimite, olvidarTodo } = await import("@/lib/limite-peticiones");
const { firmarCanal } = await import("@/lib/ver-juntos/firma");

const SALA = "presence-juntos-4821";
const YO = { id: "aparato_123", nombre: "  Tele\nsala " };

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

  it("firma una sala de presencia con el alias limpio del aparato", async () => {
    const respuesta = await POST(pedir({ socket_id: "123.456", channel_name: SALA, ...YO }));
    expect(respuesta.status).toBe(200);
    const cuerpo = (await respuesta.json()) as { auth: string; channel_data: string };
    expect(JSON.parse(cuerpo.channel_data)).toEqual({ user_id: "aparato_123", user_info: { nombre: "Tele sala" } });
    expect(cuerpo.auth).toBe(`clave-publica:${firmarCanal("secreto-de-prueba", "123.456", SALA, cuerpo.channel_data)}`);
  });

  it("sigue firmando aunque el buscador y las carátulas hayan agotado su cupo", async () => {
    // Sin cabeceras de IP, la ruta cuenta a quien llama como «desconocido».
    for (let i = 0; i <= LIMITES.PETICIONES; i++) excedeLimite("desconocido");
    expect(excedeLimite("desconocido")).toBe(true);
    expect((await POST(pedir({ socket_id: "123.456", channel_name: SALA, ...YO }))).status).toBe(200);
  });

  it("su propio cupo también corta: 30 por minuto y por IP", async () => {
    for (let i = 0; i < LIMITES.PETICIONES; i++) {
      expect((await POST(pedir({ socket_id: "123.456", channel_name: SALA, ...YO }))).status).toBe(200);
    }
    expect((await POST(pedir({ socket_id: "123.456", channel_name: SALA, ...YO }))).status).toBe(429);
  });

  it("no firma canales que no son salas de cuatro cifras", async () => {
    for (const canal of ["private-admin", "presence-juntos-48211", "presence-juntos-ab12", "private-juntos-4821"]) {
      expect((await POST(pedir({ socket_id: "123.456", channel_name: canal, ...YO }))).status).toBe(403);
    }
  });

  it("pide un id de aparato con forma, y rechaza un socket_id raro", async () => {
    expect((await POST(pedir({ socket_id: "123.456", channel_name: SALA, id: "x" }))).status).toBe(400);
    expect((await POST(pedir({ socket_id: "abc", channel_name: SALA, ...YO }))).status).toBe(400);
  });

  it("dice que no está configurada en vez de firmar con nada", async () => {
    secreto.valor = "";
    expect((await POST(pedir({ socket_id: "123.456", channel_name: SALA, ...YO }))).status).toBe(503);
  });
});
