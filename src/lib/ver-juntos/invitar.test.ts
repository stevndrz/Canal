import qrcode from "qrcode-generator";
import { describe, expect, it } from "vitest";
import { enlaceDeSala, textoDeInvitacion, trazoDeQr } from "./invitar";
import { normalizarCodigo } from "./sala";

describe("invitar a la sala", () => {
  it("el enlace lleva el código donde la app lo espera", () => {
    expect(enlaceDeSala("https://canal.example", "8047")).toBe("https://canal.example/?sala=8047");
    expect(enlaceDeSala("https://canal.example/", "8047")).toBe("https://canal.example/?sala=8047");
    // Lo que se comparte es lo que después se lee.
    expect(normalizarCodigo(new URL(enlaceDeSala("https://x.test", "0042")).searchParams.get("sala") ?? "")).toBe("0042");
  });

  it("el texto nombra la película si la hay", () => {
    expect(textoDeInvitacion("Coco", "8047")).toBe("Veamos «Coco» juntos en CanalCasa. Sala 8047.");
    expect(textoDeInvitacion(undefined, "8047")).toBe("Entra a mi sala de CanalCasa: 8047.");
  });
});

describe("trazoDeQr", () => {
  it("junta los módulos seguidos en un rectángulo y deja el margen alrededor", () => {
    const dibujo = ["##.", "...", "#.#"];
    const { lado, d } = trazoDeQr((f, c) => dibujo[f]![c] === "#", 3, 4);
    expect(lado).toBe(11);
    expect(d).toBe("M4 4h2v1h-2zM4 6h1v1h-1zM6 6h1v1h-1z");
  });

  it("pinta exactamente los módulos oscuros de un QR de verdad", () => {
    const qr = qrcode(0, "M");
    qr.addData(enlaceDeSala("https://canal-casa.vercel.app", "8047"));
    qr.make();
    const n = qr.getModuleCount();
    const { lado, d } = trazoDeQr((f, c) => qr.isDark(f, c), n);
    expect(lado).toBe(n + 8);
    // La suma de los anchos de las tiradas es el número de módulos oscuros.
    const pintados = [...d.matchAll(/h(\d+)v1/g)].reduce((t, m) => t + Number(m[1]), 0);
    let oscuros = 0;
    for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (qr.isDark(f, c)) oscuros++;
    expect(pintados).toBe(oscuros);
    // Un enlace corto cabe en un QR pequeño: se lee bien desde el sofá.
    expect(n).toBeLessThanOrEqual(33);
  });
});
