import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { crearPusherFalso, type PusherFalso } from "./pusher-falso";
import { ipDePrueba, nuevoAparato, type NombreAparato } from "./aparatos";
import { CLAVE_PUSHER, SECRETO_PUSHER } from "./constantes.mjs";

/**
 * Ver juntos, con varios aparatos de verdad (cada uno su contexto, con su
 * `localStorage`) y el Pusher de mentira que comprueba la firma.
 */

interface Aparato {
  contexto: BrowserContext;
  page: Page;
}

async function abrir(browser: Browser, pusher: PusherFalso, cual: NombreAparato): Promise<Aparato> {
  const contexto = await nuevoAparato(browser, cual);
  await pusher.conectar(contexto);
  const page = await contexto.newPage();
  await page.goto("/?vista=fuente");
  await expect(page.getByRole("heading", { name: "Nuestras películas" })).toBeVisible();
  return { contexto, page };
}

async function ponerAlias(page: Page, alias: string) {
  await page.getByRole("textbox", { name: "Tu alias" }).fill(alias);
  await page.getByRole("button", { name: "Listo", exact: true }).click();
}

async function crearSala(page: Page, alias: string): Promise<string> {
  await page.getByRole("button", { name: "Crear sala" }).click();
  await ponerAlias(page, alias);
  const codigo = page.locator(".cine-codigo");
  await expect(codigo).toHaveText(/^\d{4}$/);
  return (await codigo.textContent())!;
}

async function entrarEnSala(page: Page, alias: string, codigo: string) {
  await page.getByRole("button", { name: "Entrar con código" }).click();
  await ponerAlias(page, alias);
  for (const cifra of codigo) await page.getByRole("dialog").getByRole("button", { name: cifra, exact: true }).click();
  await expect(page.locator(".cine-codigo")).toHaveText(codigo);
}

const video = (page: Page) =>
  page.evaluate(() => {
    const v = document.querySelector("video");
    return v ? { tiempo: v.currentTime, pausado: v.paused, listo: v.readyState } : null;
  });

async function esperarReproduciendo(page: Page) {
  await expect.poll(async () => (await video(page))?.pausado, { timeout: 15_000 }).toBe(false);
}

test.describe("Ver juntos", () => {
  let pusher: PusherFalso;
  test.beforeEach(() => {
    pusher = crearPusherFalso(CLAVE_PUSHER, SECRETO_PUSHER);
  });

  test("PC e iPhone: la película llega sola, «Empezar» arranca a los dos y la pausa y el salto viajan", async ({ browser }) => {
    const pc = await abrir(browser, pusher, "pc");
    const iphone = await abrir(browser, pusher, "iphone");

    const codigo = await crearSala(pc.page, "Steven");
    await entrarEnSala(iphone.page, "Teléfono", codigo);

    // Presencia: cada uno ve al otro, con su alias.
    await expect(pc.page.getByLabel("Quién está en la sala")).toContainText("Teléfono");
    await expect(iphone.page.getByLabel("Quién está en la sala")).toContainText("Steven");
    // La película la puso quien creó la sala; al otro le llega sin elegirla.
    await expect(iphone.page.locator("#cine-titulo")).toHaveText("Coco");
    expect(pusher.rechazadas).toEqual([]);

    await pc.page.getByRole("button", { name: "Empezar", exact: true }).click();
    await expect(iphone.page.locator(".cine-cuenta")).toBeVisible();
    await esperarReproduciendo(pc.page);
    await esperarReproduciendo(iphone.page);

    // Pausa en el teléfono → se pausa el PC.
    await iphone.page.evaluate(() => document.querySelector("video")!.pause());
    await expect.poll(async () => (await video(pc.page))?.pausado).toBe(true);
    await expect(pc.page.locator(".cine-aviso-otro")).toContainText("Teléfono pausó");

    // Salto en el PC → el teléfono va al mismo minuto.
    await pc.page.evaluate(() => {
      document.querySelector("video")!.currentTime = 60;
    });
    await expect.poll(async () => Math.abs(((await video(iphone.page))?.tiempo ?? 0) - 60)).toBeLessThan(1.5);

    // Reanudar en el PC → sigue el teléfono, y van a menos de la tolerancia.
    await pc.page.evaluate(() => document.querySelector("video")!.play());
    await esperarReproduciendo(iphone.page);
    await pc.page.waitForTimeout(6000); // un pulso de quien dirige
    const [a, b] = await Promise.all([video(pc.page), video(iphone.page)]);
    expect(Math.abs(a!.tiempo - b!.tiempo)).toBeLessThan(1.5);

    await pc.contexto.close();
    await iphone.contexto.close();
  });

  test("Tele: entra con los números del mando y cambiar de película cambia la de todos", async ({ browser }) => {
    const pc = await abrir(browser, pusher, "pc");
    const tele = await abrir(browser, pusher, "tele");

    const codigo = await crearSala(pc.page, "Steven");
    await tele.page.getByRole("button", { name: "Entrar con código" }).click();
    await tele.page.getByRole("button", { name: "Tele sala" }).click();
    await tele.page.getByRole("button", { name: "Listo", exact: true }).click();
    // Los números del mando, sin tocar el teclado de la pantalla.
    for (const cifra of codigo) await tele.page.keyboard.press(cifra);
    await expect(tele.page.locator(".cine-codigo")).toHaveText(codigo);
    await expect(tele.page.locator("#cine-titulo")).toHaveText("Coco");

    // La tele elige otra: la última elegida manda, también en el PC.
    await tele.page.getByRole("button", { name: "Matrix" }).click();
    await expect(pc.page.locator("#cine-titulo")).toHaveText("Matrix");

    await pc.contexto.close();
    await tele.contexto.close();
  });

  test("Una firma manipulada no entra en la sala", async ({ browser }) => {
    const intruso = await abrir(browser, pusher, "pc");
    await intruso.page.route("**/api/pusher/auth", async (ruta) => {
      const respuesta = await ruta.fetch();
      const cuerpo = (await respuesta.json()) as { auth: string; channel_data: string };
      // Cambia quién dice ser DESPUÉS de firmar: la firma ya no corresponde.
      const datos = JSON.parse(cuerpo.channel_data) as { user_info: { nombre: string } };
      datos.user_info.nombre = "Otro";
      await ruta.fulfill({ json: { ...cuerpo, channel_data: JSON.stringify(datos) } });
    });
    await crearSala(intruso.page, "Steven");
    await expect(intruso.page.locator(".cine-estado")).toContainText("No se pudo conectar");
    expect(pusher.rechazadas).toHaveLength(1);
    await intruso.contexto.close();
  });

  test("Cada carátula se pide una sola vez (comparte cupo con la entrada a la sala)", async ({ browser }) => {
    const contexto = await nuevoAparato(browser, "pc");
    await pusher.conectar(contexto);
    const page = await contexto.newPage();
    const pedidas: string[] = [];
    page.on("request", (peticion) => {
      const url = new URL(peticion.url());
      if (url.pathname === "/api/buscar") pedidas.push(url.searchParams.get("q") ?? "");
    });
    await page.goto("/?vista=fuente");
    await crearSala(page, "Steven");
    await page.getByRole("button", { name: "Matrix" }).click();
    await page.waitForTimeout(1500);
    expect(pedidas.sort()).toEqual(["Coco", "Matrix"]);
    await contexto.close();
  });

  test("La ruta de firma solo firma salas de cuatro cifras", async ({ request }) => {
    const ip = ipDePrueba();
    const firmar = (canal: string) =>
      request.post("/api/pusher/auth", {
        headers: { "x-real-ip": ip },
        form: { socket_id: "1.2", channel_name: canal, id: "aparato-de-prueba", nombre: "X" },
      });
    expect((await firmar("presence-juntos-1234")).status()).toBe(200);
    expect((await firmar("presence-otra-cosa")).status()).toBe(403);
    expect((await firmar("private-juntos-1234")).status()).toBe(403);
  });
});
