import { beforeEach, describe, expect, it, vi } from "vitest";

/** Vincular un aparato: PIN + nombre → llave. */
const sala = { salaPin: "4821", salaSecreto: "s".repeat(40) };
vi.mock("@/lib/config.server", () => ({ serverConfig: () => sala }));

const { POST } = await import("./route");
const { olvidarTodo } = await import("@/lib/limite-peticiones");
const { reiniciarIntentos } = await import("@/lib/ver-juntos/intentos-pin");
const { leerLlave, canalDeLaSala } = await import("@/lib/ver-juntos/vinculo");

function pedir(cuerpo: unknown, ip = "1.2.3.4"): Request {
  return new Request("http://localhost/api/sala/vincular", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify(cuerpo),
  });
}

describe("/api/sala/vincular", () => {
  beforeEach(() => {
    olvidarTodo();
    reiniciarIntentos();
    sala.salaPin = "4821";
  });

  it("con el PIN bueno da una llave válida, el canal y el nombre", async () => {
    const respuesta = await POST(pedir({ pin: "4821", nombre: "  Tele sala " }));
    expect(respuesta.status).toBe(200);
    const cuerpo = (await respuesta.json()) as { llave: string; canal: string; id: string; nombre: string };
    const config = { pin: "4821", secreto: sala.salaSecreto };
    expect(cuerpo.nombre).toBe("Tele sala");
    expect(cuerpo.canal).toBe(canalDeLaSala(config));
    expect(leerLlave(config, cuerpo.llave)).toEqual({ id: cuerpo.id, nombre: "Tele sala" });
  });

  it("con el PIN malo dice cuántos intentos quedan, y a los cinco bloquea", async () => {
    const primera = await POST(pedir({ pin: "0000", nombre: "x" }));
    expect(primera.status).toBe(401);
    expect(((await primera.json()) as { error: string }).error).toMatch(/4 intentos/);
    for (let i = 0; i < 4; i++) await POST(pedir({ pin: "0000", nombre: "x" }));
    // Bloqueado aunque ahora acierte.
    expect((await POST(pedir({ pin: "4821", nombre: "x" }))).status).toBe(429);
    // Otra IP sigue pudiendo.
    expect((await POST(pedir({ pin: "4821", nombre: "x" }, "5.6.7.8"))).status).toBe(200);
  });

  it("pide un nombre", async () => {
    expect((await POST(pedir({ pin: "4821", nombre: "   " }))).status).toBe(400);
  });

  it("sin SALA_PIN válido, dice que falta configurarla", async () => {
    sala.salaPin = "";
    expect((await POST(pedir({ pin: "4821", nombre: "x" }))).status).toBe(503);
  });
});
