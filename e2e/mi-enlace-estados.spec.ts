import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { crearPusherFalso, type PusherFalso } from "./pusher-falso";
import { nuevoAparato, type NombreAparato } from "./aparatos";
import { CLAVE_PUSHER, SECRETO_PUSHER } from "./constantes.mjs";

/**
 * Mi enlace dentro de la sala: esperando, viendo y en pausa. Cada estado, un
 * único botón principal. Y el enlace de invitación, que entra directo.
 */

async function abrir(browser: Browser, pusher: PusherFalso, cual: NombreAparato, ruta = "/?vista=fuente"): Promise<{ contexto: BrowserContext; page: Page }> {
  const contexto = await nuevoAparato(browser, cual);
  await pusher.conectar(contexto);
  const page = await contexto.newPage();
  await page.goto(ruta);
  return { contexto, page };
}

async function crearSala(page: Page, alias: string): Promise<string> {
  await page.getByRole("button", { name: "Crear sala" }).click();
  await page.getByRole("textbox", { name: "Tu nombre" }).fill(alias);
  await page.getByRole("button", { name: "Listo", exact: true }).click();
  const codigo = page.locator(".cine-codigo");
  await expect(codigo).toHaveText(/^\d{4}$/);
  return (await codigo.textContent())!;
}

const reproduciendo = (page: Page) => page.evaluate(() => Boolean(document.querySelector("video") && !document.querySelector("video")!.paused));

test.describe("Mi enlace por estados, en la sala", () => {
  let pusher: PusherFalso;
  test.beforeEach(() => {
    pusher = crearPusherFalso(CLAVE_PUSHER, SECRETO_PUSHER);
  });

  test("PC: a solas, lo principal es «Invitar», y copia un enlace que entra directo", async ({ browser }) => {
    const pc = await abrir(browser, pusher, "pc");
    await pc.contexto.grantPermissions(["clipboard-read", "clipboard-write"]);
    const codigo = await crearSala(pc.page, "Steven");
    const principal = pc.page.locator(".cine-boton-principal");
    await expect(principal).toHaveCount(1);
    await expect(principal).toHaveText("Invitar");
    // Empezar sin esperar sigue ahí, sin competir.
    await expect(pc.page.getByRole("button", { name: "Empezar sin esperar" })).toHaveClass(/cine-boton-texto/);

    await principal.click();
    await expect(pc.page.locator(".cine-estado")).toHaveText("Enlace copiado: pégalo en un mensaje.");
    const copiado = await pc.page.evaluate(() => navigator.clipboard.readText());
    expect(copiado).toContain(`/?sala=${codigo}`);
    expect(copiado).toContain("Coco");

    // Quien abre ese enlace sin haber usado nunca la app: su nombre y dentro.
    const enlace = new URL(copiado.slice(copiado.indexOf("http")));
    const invitada = await abrir(browser, pusher, "iphone", enlace.pathname + enlace.search);
    // La bienvenida, en tres pasos: su nombre, «ya estás dentro» y «todos mandan».
    const alias = invitada.page.getByRole("dialog", { name: "Te invitaron a ver una película" });
    await expect(alias).toContainText("Paso 1 de 3");
    await alias.getByRole("textbox", { name: "Tu nombre" }).fill("Ana");
    await invitada.page.getByRole("button", { name: "Listo", exact: true }).click();
    const dentro = invitada.page.getByRole("dialog", { name: "Ya estás dentro" });
    await expect(dentro).toContainText(`Paso 2 de 3`);
    await expect(dentro).toContainText(`Estás en la sala ${codigo}`);
    await dentro.getByRole("button", { name: "Siguiente" }).click();
    const mandan = invitada.page.getByRole("dialog", { name: "Todos mandan" });
    await expect(mandan).toContainText("Cualquiera puede pausar");
    await mandan.getByRole("button", { name: "Entendido" }).click();
    await expect(invitada.page.getByRole("dialog")).toHaveCount(0);
    await expect(invitada.page.locator(".cine-codigo")).toHaveText(codigo);
    await expect(invitada.page.locator("#cine-titulo")).toHaveText("Coco");
    // El código no se queda en la barra: recargar no vuelve a «entrar por enlace».
    expect(new URL(invitada.page.url()).searchParams.get("sala")).toBeNull();

    // Ya acompañado, lo principal pasa a ser empezar.
    await expect(pc.page.getByLabel("Quién está en la sala")).toContainText("Ana");
    await expect(principal).toHaveText("Empezar");
    await pc.contexto.close();
    await invitada.contexto.close();
  });

  test("Con nombre ya puesto, el enlace de invitación entra sin preguntar nada", async ({ browser }) => {
    const pc = await abrir(browser, pusher, "pc");
    const codigo = await crearSala(pc.page, "Steven");
    const contexto = await nuevoAparato(browser, "iphone");
    await pusher.conectar(contexto);
    await contexto.addInitScript(() => localStorage.setItem("canalcasa:juntos-perfil", JSON.stringify({ id: "aparato-prueba-0002", nombre: "Ana" })));
    const page = await contexto.newPage();
    await page.goto(`/?sala=${codigo}`);
    await expect(page.locator(".cine-codigo")).toHaveText(codigo);
    await expect(pc.page.getByLabel("Quién está en la sala")).toContainText("Ana");
    // Un «código» que no lo es no hace nada raro: Inicio, como siempre.
    // En un aparato aparte: en este, la app ya recuerda la sala en la que
    // acaba de entrar Ana y, con razón, vuelve a ella al abrir (`haySalaReciente`).
    // Según si ya lo había guardado o no, la prueba fallaba una de cada pocas.
    const aparte = await nuevoAparato(browser, "iphone");
    const otro = await aparte.newPage();
    await otro.goto("/?sala=hola");
    await expect(otro.locator(".cine-codigo")).toHaveCount(0);
    await pc.contexto.close();
    await contexto.close();
    await aparte.close();
  });

  test("Tele: sin forma de compartir, lo principal es empezar", async ({ browser }) => {
    const tele = await abrir(browser, pusher, "tele");
    await crearSala(tele.page, "Tele sala");
    await expect(tele.page.locator(".cine-boton-principal")).toHaveText("Empezar sin esperar");
    await expect(tele.page.getByRole("button", { name: "Invitar" })).toHaveCount(0);
    await tele.contexto.close();
  });

  test("Tele: a solas enseña un QR que lleva a la sala, y se quita cuando entra alguien", async ({ browser }) => {
    const tele = await abrir(browser, pusher, "tele");
    const codigo = await crearSala(tele.page, "Tele sala");
    const qr = tele.page.getByRole("img", { name: `Código QR para entrar en la sala ${codigo.split("").join(" ")}` });
    await expect(qr).toBeVisible();
    await expect(tele.page.locator(".cine-qr")).toContainText("Escanea con el teléfono");
    // Entero dentro de la pantalla y con tamaño para leerse desde el sofá.
    const caja = (await tele.page.locator(".cine-qr").boundingBox())!;
    expect(caja.width).toBeGreaterThanOrEqual(180);
    expect(caja.x + caja.width).toBeLessThanOrEqual(1920);
    expect(caja.y).toBeGreaterThanOrEqual(0);
    // Qué codifica lo prueba `invitar.test.ts`; aquí, que se pinta de verdad
    // (el Chromium de pruebas no trae lector de códigos).
    expect((await tele.page.locator(".cine-qr-tinta").getAttribute("d"))!.length).toBeGreaterThan(500);

    const iphone = await abrir(browser, pusher, "iphone", `/?sala=${codigo}`);
    await iphone.page.getByRole("textbox", { name: "Tu nombre" }).fill("Ana");
    await iphone.page.getByRole("button", { name: "Listo", exact: true }).click();
    await expect(tele.page.getByLabel("Quién está en la sala")).toContainText("Ana");
    await expect(tele.page.locator(".cine-qr")).toHaveCount(0);
    await tele.contexto.close();
    await iphone.contexto.close();
  });

  test("Viendo no hay botón principal; en pausa dice quién pausó y «Seguir» reanuda a los dos", async ({ browser }) => {
    const pc = await abrir(browser, pusher, "pc");
    const iphone = await abrir(browser, pusher, "iphone");
    const codigo = await crearSala(pc.page, "Steven");
    await iphone.page.getByRole("button", { name: "Entrar con código" }).click();
    await iphone.page.getByRole("textbox", { name: "Tu nombre" }).fill("Ana");
    await iphone.page.getByRole("button", { name: "Listo", exact: true }).click();
    for (const cifra of codigo) await iphone.page.getByRole("dialog").getByRole("button", { name: cifra, exact: true }).click();
    await expect(iphone.page.locator(".cine-codigo")).toHaveText(codigo);

    await pc.page.getByRole("button", { name: "Empezar", exact: true }).click();
    await expect.poll(() => reproduciendo(pc.page), { timeout: 15_000 }).toBe(true);
    await expect.poll(() => reproduciendo(iphone.page), { timeout: 15_000 }).toBe(true);

    // Viendo: el reproductor y quién está. Nada más pide atención.
    for (const page of [pc.page, iphone.page]) {
      await expect(page.locator(".cine-boton-principal")).toHaveCount(0);
      await expect(page.getByLabel("Quién está en la sala")).toBeVisible();
      await expect(page.locator(".cine-vistas")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Usar un enlace" })).toHaveCount(0);
    }

    // Pausa Steven en el PC.
    await pc.page.waitForTimeout(2500);
    await pc.page.evaluate(() => document.querySelector("video")!.pause());
    await expect.poll(() => reproduciendo(iphone.page)).toBe(false);
    await expect(pc.page.locator(".cine-pausa")).toHaveText(/^Pausaste · van por 0:0\d$/);
    await expect(iphone.page.locator(".cine-pausa")).toHaveText(/^Steven pausó · van por 0:0\d$/);
    await expect(iphone.page.locator(".cine-boton-principal")).toHaveText("Seguir");
    await expect(iphone.page.locator(".cine-boton-principal")).toHaveCount(1);

    // «Seguir» en el teléfono reanuda a los dos.
    await iphone.page.locator(".cine-boton-principal").click();
    await expect.poll(() => reproduciendo(iphone.page)).toBe(true);
    await expect.poll(() => reproduciendo(pc.page)).toBe(true);
    await expect(pc.page.locator(".cine-pausa")).toHaveCount(0);
    await pc.contexto.close();
    await iphone.contexto.close();
  });

  test("iPhone: la película sale en la pantalla de bloqueo, y en la sala la pantalla no se apaga", async ({ browser }) => {
    const contexto = await nuevoAparato(browser, "iphone");
    await pusher.conectar(contexto);
    // El cerrojo de pantalla de verdad no se puede mirar desde fuera: se apunta quién lo pide y quién lo suelta.
    await contexto.addInitScript(() => {
      const cuenta = { pedidos: 0, sueltos: 0 };
      (window as unknown as { __pantalla: typeof cuenta }).__pantalla = cuenta;
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value: {
          request: async () => {
            cuenta.pedidos += 1;
            return { addEventListener() {}, release: async () => void (cuenta.sueltos += 1) };
          },
        },
      });
    });
    const page = await contexto.newPage();
    await page.goto("/?vista=fuente");
    const pantalla = () => page.evaluate(() => (window as unknown as { __pantalla: { pedidos: number; sueltos: number } }).__pantalla);
    const sesion = () => page.evaluate(() => ({ titulo: navigator.mediaSession.metadata?.title ?? null, estado: navigator.mediaSession.playbackState }));

    // Fuera de la sala no se toca la pantalla.
    await expect(page.locator("video")).toBeAttached();
    await expect.poll(sesion).toEqual({ titulo: "Coco", estado: "paused" });
    expect((await pantalla()).pedidos).toBe(0);

    // Dentro, esperando a alguien: encendida.
    await crearSala(page, "Steven");
    await expect.poll(async () => (await pantalla()).pedidos).toBeGreaterThanOrEqual(1);

    await page.getByRole("button", { name: "Empezar sin esperar" }).click();
    await expect.poll(async () => (await sesion()).estado, { timeout: 15_000 }).toBe("playing");
    await page.evaluate(() => document.querySelector("video")!.pause());
    await expect.poll(async () => (await sesion()).estado).toBe("paused");

    // Al salir de la sala se suelta: todo lo pedido, soltado.
    await page.getByRole("button", { name: "Salir de la sala" }).click();
    await expect.poll(async () => {
      const p = await pantalla();
      return p.pedidos - p.sueltos;
    }).toBe(0);
    await contexto.close();
  });
});
