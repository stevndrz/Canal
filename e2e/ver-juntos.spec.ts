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
  await page.getByRole("textbox", { name: "Tu nombre" }).fill(alias);
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

/** Con la película en marcha los controles se esconden solos: un toque los trae. */
async function mostrarControles(page: Page) {
  if ((await page.locator(".atv.atv-activo").count()) === 0) await page.locator("video").tap();
  await expect(page.locator(".atv.atv-activo")).toBeVisible();
}

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
    // Durante la cuenta atrás no arranca nadie: los dos empiezan al acabar.
    await pc.page.waitForTimeout(1200);
    expect((await video(iphone.page))?.pausado).toBe(true);
    expect((await video(pc.page))?.pausado).toBe(true);
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
    await tele.page.getByRole("button", { name: "Cambiar película" }).click();
    await tele.page.getByRole("button", { name: "Matrix" }).click();
    await expect(pc.page.locator("#cine-titulo")).toHaveText("Matrix");

    await pc.contexto.close();
    await tele.contexto.close();
  });

  test("Seguir viendo juntos: al volver a la sala se ofrece retomar, y lleva a los dos al mismo minuto", async ({ browser }) => {
    const pc = await abrir(browser, pusher, "pc");
    const iphone = await abrir(browser, pusher, "iphone");
    const codigo = await crearSala(pc.page, "Steven");
    await entrarEnSala(iphone.page, "Teléfono", codigo);
    await pc.page.getByRole("button", { name: "Empezar", exact: true }).click();
    await esperarReproduciendo(iphone.page);

    // Ven hasta el 1:10 y lo dejan.
    await pc.page.evaluate(() => {
      document.querySelector("video")!.currentTime = 70;
    });
    await expect.poll(async () => Math.abs(((await video(iphone.page))?.tiempo ?? 0) - 70)).toBeLessThan(1.5);
    await pc.page.evaluate(() => document.querySelector("video")!.pause());
    await expect.poll(async () => (await video(iphone.page))?.pausado).toBe(true);
    await pc.page.close();
    await iphone.page.close();

    // Otro día: pestañas nuevas en los mismos aparatos (mismo `localStorage`).
    const pc2 = await pc.contexto.newPage();
    const iphone2 = await iphone.contexto.newPage();
    for (const page of [pc2, iphone2]) {
      await page.goto("/?vista=fuente");
      await expect(page.getByRole("list", { name: "Vistas juntos" })).toContainText("Coco");
    }
    await expect(pc2.getByRole("list", { name: "Vistas juntos" })).toContainText("con Teléfono");
    // Sin dictarse el código ni pulsar nada: al abrir, los dos siguen en su sala.
    await expect(pc2.locator(".cine-codigo")).toHaveText(codigo);
    await expect(iphone2.locator(".cine-codigo")).toHaveText(codigo);
    await expect(iphone2.locator("#cine-titulo")).toHaveText("Coco");
    await expect(pc2.getByLabel("Quién está en la sala")).toContainText("Teléfono");

    // Lo pulsa el teléfono, que NO dirige: tiene que mover también al PC.
    await iphone2.getByRole("button", { name: /^Retomar en 1:(09|10|11)$/ }).click();
    await esperarReproduciendo(pc2);
    await esperarReproduciendo(iphone2);
    const [a, b] = await Promise.all([video(pc2), video(iphone2)]);
    expect(a!.tiempo).toBeGreaterThan(65);
    expect(Math.abs(a!.tiempo - b!.tiempo)).toBeLessThan(1.5);

    await pc.contexto.close();
    await iphone.contexto.close();
  });

  test("La invitada manda igual: pausa, salta y reanuda con los botones del reproductor, desde el teléfono", async ({ browser }) => {
    const pc = await abrir(browser, pusher, "pc");
    const invitada = await abrir(browser, pusher, "iphone");
    const codigo = await crearSala(pc.page, "Steven");
    await entrarEnSala(invitada.page, "Majo", codigo);
    await pc.page.getByRole("button", { name: "Empezar", exact: true }).click();
    await esperarReproduciendo(invitada.page);

    // Todos los botones caben en el ancho del teléfono: ninguno cortado ni montado sobre otro.
    await mostrarControles(invitada.page);
    const cajas = await invitada.page.evaluate(() => {
      const marco = document.querySelector(".atv")!.getBoundingClientRect();
      const botones = [...document.querySelectorAll<HTMLElement>(".atv-fila .atv-btn")]
        .filter((b) => b.offsetParent !== null)
        .map((b) => b.getBoundingClientRect())
        .sort((a, b) => a.left - b.left);
      return {
        dentro: botones.every((b) => b.left >= marco.left && b.right <= marco.right),
        sinMontarse: botones.every((b, i) => i === 0 || b.left >= botones[i - 1]!.right - 1),
        cuantos: botones.length,
      };
    });
    expect(cajas.cuantos).toBeGreaterThanOrEqual(5);
    expect(cajas.dentro).toBe(true);
    expect(cajas.sinMontarse).toBe(true);
    await expect(invitada.page.getByRole("button", { name: "Pantalla completa", exact: true }).last()).toBeVisible();

    // Pausa ella → se pausa él.
    await mostrarControles(invitada.page);
    await invitada.page.getByRole("button", { name: "Pausar" }).click();
    await expect.poll(async () => (await video(pc.page))?.pausado).toBe(true);
    await expect(pc.page.locator(".cine-aviso-otro")).toContainText("Majo pausó");

    // Adelanta ella 10 s tres veces → él va al mismo sitio.
    const antes = (await video(invitada.page))!.tiempo;
    for (let i = 0; i < 3; i++) await invitada.page.getByRole("button", { name: "Avanzar 10 segundos" }).click();
    await expect.poll(async () => (await video(pc.page))?.tiempo ?? 0).toBeGreaterThan(antes + 25);

    // Reanuda ella → sigue él, y van juntos.
    await invitada.page.getByRole("button", { name: "Reproducir" }).last().click();
    await esperarReproduciendo(pc.page);
    await pc.page.waitForTimeout(6000);
    const [a, b] = await Promise.all([video(pc.page), video(invitada.page)]);
    expect(b!.pausado).toBe(false);
    expect(Math.abs(a!.tiempo - b!.tiempo)).toBeLessThan(1.5);

    await pc.contexto.close();
    await invitada.contexto.close();
  });

  test("Quién está y cómo: viendo, en la sala y fuera un momento", async ({ browser }) => {
    const pc = await abrir(browser, pusher, "pc");
    const movil = await abrir(browser, pusher, "iphone");
    const codigo = await crearSala(pc.page, "Steven");
    await entrarEnSala(movil.page, "Majo", codigo);
    const majoEnPc = pc.page.getByLabel("Quién está en la sala").getByRole("listitem").filter({ hasText: "Majo" });
    await expect(majoEnPc).toContainText("En la sala");

    await pc.page.getByRole("button", { name: "Empezar", exact: true }).click();
    await esperarReproduciendo(movil.page);
    await expect(majoEnPc).toContainText("Viendo");

    // Se le corta (el iPhone cierra la app): su círculo se queda, apagado.
    await pusher.cortar(movil.contexto);
    await movil.page.close();
    await expect(majoEnPc).toContainText("Fuera un momento");

    await pc.contexto.close();
    await movil.contexto.close();
  });

  test("Salir de la app no saca de la sala: al abrirla otra vez se vuelve sola, sin código", async ({ browser }) => {
    const pc = await abrir(browser, pusher, "pc");
    const movil = await abrir(browser, pusher, "iphone");
    const codigo = await crearSala(pc.page, "Steven");
    await entrarEnSala(movil.page, "Majo", codigo);
    await pc.page.getByRole("button", { name: "Empezar", exact: true }).click();
    await esperarReproduciendo(movil.page);
    await pc.page.evaluate(() => {
      document.querySelector("video")!.currentTime = 50;
    });
    await expect.poll(async () => Math.abs(((await video(movil.page))?.tiempo ?? 0) - 50)).toBeLessThan(2);

    // El iPhone mata la app: página nueva, y `sessionStorage` vacío como allí.
    await movil.page.close();
    const otraVez = await movil.contexto.newPage();
    await otraVez.addInitScript(() => sessionStorage.clear());
    // Abre la app por su inicio, no por Mi enlace.
    await otraVez.goto("/");
    await expect(otraVez.locator(".cine-codigo")).toHaveText(codigo);
    await expect(otraVez.getByLabel("Quién está en la sala")).toContainText("Steven");
    await expect(otraVez.locator("#cine-titulo")).toHaveText("Coco");
    // Y recibe por dónde va la película sin que nadie se lo dicte.
    await expect.poll(async () => (await video(otraVez))?.tiempo ?? 0, { timeout: 15_000 }).toBeGreaterThan(45);

    // «Salir de la sala» sí saca: la próxima vez abre en Inicio.
    await otraVez.getByRole("button", { name: "Salir de la sala" }).click();
    await otraVez.goto("/");
    await expect(otraVez.locator(".cine-codigo")).toHaveCount(0);
    // …pero la sala sigue a un botón, sin código.
    await otraVez.goto("/?vista=fuente");
    await otraVez.getByRole("button", { name: `Volver a la sala ${codigo}` }).click();
    await expect(otraVez.locator(".cine-codigo")).toHaveText(codigo);

    await pc.contexto.close();
    await movil.contexto.close();
  });

  test("El código escrito en la casilla del nombre no se acepta como nombre", async ({ browser }) => {
    const { page, contexto } = await abrir(browser, pusher, "iphone");
    await page.getByRole("button", { name: "Entrar con código" }).click();
    await page.getByRole("textbox", { name: "Tu nombre" }).fill("8047");
    await expect(page.getByText("Eso parece el código de la sala")).toBeVisible();
    await expect(page.getByRole("button", { name: "Listo", exact: true })).toBeDisabled();
    await contexto.close();
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

  test("Cada carátula se pide una sola vez", async ({ browser }) => {
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
    await page.getByRole("button", { name: "Cambiar película" }).click();
    await page.getByRole("button", { name: "Matrix" }).click();
    await page.waitForTimeout(1500);
    expect(pedidas.sort()).toEqual(["Coco", "Matrix"]);
    await contexto.close();
  });

  test("Con el cupo del buscador agotado se sigue pudiendo entrar en la sala", async ({ browser }) => {
    const contexto = await nuevoAparato(browser, "pc");
    await pusher.conectar(contexto);
    const page = await contexto.newPage();
    await page.goto("/?vista=fuente");
    await expect(page.getByRole("heading", { name: "Nuestras películas" })).toBeVisible();
    // Desde este mismo aparato (misma IP), hasta que el buscador diga basta.
    const estados = await page.evaluate(async () => {
      const vistos: number[] = [];
      for (let i = 0; i < 40; i++) vistos.push((await fetch(`/api/buscar?q=cupo-${i}`)).status);
      return vistos;
    });
    expect(estados.at(-1)).toBe(429);
    // La firma de la sala lleva su propia cuenta.
    await crearSala(page, "Steven");
    await expect(page.getByLabel("Quién está en la sala")).toContainText("Steven");
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
