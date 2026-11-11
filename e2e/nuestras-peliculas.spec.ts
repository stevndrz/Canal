import { expect, test } from "@playwright/test";
import { APARATOS, nuevoAparato, type NombreAparato } from "./aparatos";

/**
 * Mi enlace: «Nuestras películas» es lo primero que se ve, en cada aparato.
 */

const APARATOS_PROBADOS: { nombre: string; cual: NombreAparato }[] = [
  { nombre: "PC", cual: "pc" },
  { nombre: "iPhone", cual: "iphone" },
  { nombre: "tele", cual: "tele" },
];

for (const { nombre, cual } of APARATOS_PROBADOS) {
  test(`${nombre}: el estante va arriba del reproductor y se ve sin bajar`, async ({ browser }) => {
    const contexto = await nuevoAparato(browser, cual);
    const page = await contexto.newPage();
    await page.goto("/?vista=fuente");
    const estante = page.locator(".cine-estante");
    const teatro = page.locator(".cine-teatro");
    await expect(estante.getByRole("button", { name: "Coco" })).toBeVisible();
    await expect(teatro).toBeVisible();
    const [cajaEstante, cajaTeatro] = await Promise.all([estante.boundingBox(), teatro.boundingBox()]);
    expect(cajaEstante!.y + cajaEstante!.height).toBeLessThanOrEqual(cajaTeatro!.y);
    // Entero en la primera pantalla, sin desplazar.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    expect(cajaEstante!.y + cajaEstante!.height).toBeLessThan(APARATOS[cual].viewport.height);
    // Sin desbordar a lo ancho.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await contexto.close();
  });
}

test("Tele: con el mando, el foco entra por la película elegida", async ({ browser }) => {
  const contexto = await nuevoAparato(browser, "tele");
  const page = await contexto.newPage();
  await page.goto("/?vista=fuente");
  await expect(page.locator(".cine-estante").getByRole("button", { name: "Coco" })).toHaveAttribute("data-nav-entrada", "");
  await contexto.close();
});

test("PC: al reproducir el estante se recoge y «Cambiar película» lo devuelve", async ({ browser }) => {
  const contexto = await nuevoAparato(browser, "pc");
  const page = await contexto.newPage();
  await page.goto("/?vista=fuente");
  const estante = page.locator(".cine-estante");
  const teatro = page.locator(".cine-teatro");
  await expect(estante).toBeVisible();
  const anchoAntes = (await teatro.boundingBox())!.width;

  // El reproductor se carga bajo demanda: hasta que no hay `<video>`, no hay qué arrancar.
  await expect(page.locator("video")).toBeAttached();
  // Ver a solas es el play del propio reproductor.
  await page.locator(".atv-play-central").click();
  await expect(estante).toBeHidden();
  await expect.poll(async () => (await teatro.boundingBox())!.width).toBeGreaterThan(anchoAntes);

  await page.getByRole("button", { name: "Cambiar película" }).click();
  await expect(estante).toBeVisible();
  await contexto.close();
});

/**
 * El estado del PC (`peliculas/estado.json` del bucket) se enseña en palabras.
 * El «bucket» de pruebas no lo trae: se le pone uno por aparato.
 */
const CORS = { "access-control-allow-origin": "*" };
const haceMin = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

test("iPhone: se ve qué está convirtiendo el PC, y deja de verse al reproducir", async ({ browser }) => {
  const contexto = await nuevoAparato(browser, "iphone");
  await contexto.route(/\/peliculas\/estado\.json/, (ruta) =>
    ruta.fulfill({
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ version: 1, actualizado: haceMin(0), automatica: true, haciendo: { fase: "convertir", titulo: "Buddy", porcentaje: 62 }, usado: null, limite: 10 * 1024 ** 3, pendientes: 0, fallo: false }),
    }),
  );
  const page = await contexto.newPage();
  await page.goto("/?vista=fuente");
  const pc = page.locator(".cine-pc");
  await expect(pc).toHaveText("Convirtiendo «Buddy» · 62 %");
  await expect(pc).toHaveAttribute("data-tono", "activo");
  // Cabe en el ancho del teléfono.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await expect(page.locator("video")).toBeAttached();
  // Ver a solas es el play del propio reproductor.
  await page.locator(".atv-play-central").click();
  await expect(pc).toBeHidden();
  await contexto.close();
});

test("PC: en reposo dice cuándo sincronizó y cuánto ocupa; un estado roto o ausente no enseña nada", async ({ browser }) => {
  const contexto = await nuevoAparato(browser, "pc");
  await contexto.route(/\/peliculas\/estado\.json/, (ruta) =>
    ruta.fulfill({
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify({ version: 1, actualizado: haceMin(5), automatica: true, haciendo: null, usado: 7.2 * 1024 ** 3, limite: 10 * 1024 ** 3, pendientes: 1, fallo: false }),
    }),
  );
  const page = await contexto.newPage();
  await page.goto("/?vista=fuente");
  await expect(page.locator(".cine-pc")).toHaveText("Sincronizado hace 5 min · 7,2 de 10 GB · 1 cosa por decidir en el PC");
  await contexto.close();

  for (const cuerpo of ["<html>no es json</html>", JSON.stringify({ actualizado: "nunca" })]) {
    const otro = await nuevoAparato(browser, "pc");
    await otro.route(/\/peliculas\/estado\.json/, (ruta) => ruta.fulfill({ contentType: "application/json", headers: CORS, body: cuerpo }));
    const pagina = await otro.newPage();
    await pagina.goto("/?vista=fuente");
    await expect(pagina.getByRole("heading", { name: "Nuestras películas" })).toBeVisible();
    await pagina.waitForTimeout(600);
    await expect(pagina.locator(".cine-pc")).toHaveCount(0);
    await otro.close();
  }
  // Sin estado.json (404, como hoy en el bucket de verdad) tampoco.
  const sin = await nuevoAparato(browser, "pc");
  const pagina = await sin.newPage();
  await pagina.goto("/?vista=fuente");
  await expect(pagina.getByRole("heading", { name: "Nuestras películas" })).toBeVisible();
  await pagina.waitForTimeout(600);
  await expect(pagina.locator(".cine-pc")).toHaveCount(0);
  await sin.close();
});

/**
 * Mi enlace por estados: «una pantalla, un siguiente paso». Aquí, lo que se
 * comprueba sin sala (vacío, cargando y eligiendo); lo de dentro de la sala,
 * en `mi-enlace-estados.spec.ts`.
 */
const sinPeliculas = (cuerpo = JSON.stringify({ version: 2, peliculas: [] })) => ({ contentType: "application/json", headers: CORS, body: cuerpo });

/** El botón principal es uno solo, entero a la vista y por encima de la barra de abajo del teléfono. */
async function unSoloPrincipalALaVista(page: import("@playwright/test").Page, cual: NombreAparato, texto: string | RegExp) {
  const principal = page.locator(".cine-boton-principal");
  await expect(principal).toHaveCount(1);
  await expect(principal).toHaveText(texto);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  const caja = (await principal.boundingBox())!;
  const barra = await page.locator(".mobile-bottom-nav").boundingBox();
  const suelo = barra && barra.height > 0 ? barra.y : APARATOS[cual].viewport.height;
  expect(caja.y + caja.height).toBeLessThanOrEqual(suelo);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const { nombre, cual } of APARATOS_PROBADOS) {
  test(`${nombre}: sin películas, la pantalla empieza arriba y dice cómo subir una`, async ({ browser }) => {
    const contexto = await nuevoAparato(browser, cual);
    await contexto.route(/\/peliculas\/catalogo\.json/, (ruta) => ruta.fulfill(sinPeliculas()));
    const page = await contexto.newPage();
    await page.goto("/?vista=fuente");
    // Los pasos solo salen con el catálogo ya leído (antes hay esqueletos).
    await expect(page.getByRole("list", { name: "Cómo llega una película" })).toBeVisible();
    const titulo = page.getByRole("heading", { name: "Nuestras películas" });
    await expect(titulo).toBeVisible();
    // Arriba, bajo la cabecera: nunca media pantalla vacía antes del contenido.
    expect((await titulo.boundingBox())!.y).toBeLessThan(APARATOS[cual].viewport.height * 0.25);
    // Nada que elegir: no se pide elegir.
    await expect(page.getByText("Elijan una película")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Cómo llega una película" }).getByRole("listitem")).toHaveCount(3);
    await unSoloPrincipalALaVista(page, cual, "Cómo subir una película");

    await page.locator(".cine-boton-principal").click();
    await expect(page.getByRole("dialog", { name: "Cómo subir una película" })).toContainText("Descargar desde un enlace");
    await contexto.close();
  });

  test(`${nombre}: con películas, un solo botón principal y los demás en texto`, async ({ browser }) => {
    const contexto = await nuevoAparato(browser, cual);
    const page = await contexto.newPage();
    await page.goto("/?vista=fuente");
    await expect(page.locator(".cine-estante").getByRole("button", { name: "Coco" })).toBeVisible();
    await unSoloPrincipalALaVista(page, cual, "Crear sala");
    await expect(page.getByRole("button", { name: "Entrar con código" })).toHaveClass(/cine-boton-texto/);
    // El título grande es la película, no una instrucción.
    await expect(page.locator("#cine-titulo")).toHaveText("Coco");
    // Cada tarjeta dice lo que dura.
    await expect(page.locator(".cine-poster-dato").first()).toHaveText(/min/);
    await contexto.close();
  });
}

test("iPhone: con una sala recordada, lo principal es volver a ella (también sin películas)", async ({ browser }) => {
  for (const vacio of [true, false]) {
    const contexto = await nuevoAparato(browser, "iphone");
    if (vacio) await contexto.route(/\/peliculas\/catalogo\.json/, (ruta) => ruta.fulfill(sinPeliculas()));
    await contexto.addInitScript(() => {
      localStorage.setItem("canalcasa:juntos-perfil", JSON.stringify({ id: "aparato-prueba-0001", nombre: "Steven" }));
      localStorage.setItem("canalcasa:juntos-ultima-sala", "8047");
    });
    const page = await contexto.newPage();
    await page.goto("/?vista=fuente");
    await expect(page.getByRole("heading", { name: "Nuestras películas" })).toBeVisible();
    await unSoloPrincipalALaVista(page, "iphone", "Volver a la sala 8047");
    await expect(page.getByRole("button", { name: "Crear sala" })).toHaveClass(/cine-boton-texto/);
    await contexto.close();
  }
});

test("iPhone: mientras llega el catálogo hay esqueletos, no una pantalla en negro ni un «no hay películas»", async ({ browser }) => {
  const contexto = await nuevoAparato(browser, "iphone");
  let soltar = () => {};
  const espera = new Promise<void>((resolver) => (soltar = resolver));
  await contexto.route(/\/peliculas\/catalogo\.json/, async (ruta) => {
    await espera;
    await ruta.continue();
  });
  const page = await contexto.newPage();
  await page.goto("/?vista=fuente");
  await expect(page.locator(".cine-esqueleto").first()).toBeVisible();
  await expect(page.getByText("Todavía no hay ninguna")).toHaveCount(0);
  await expect(page.locator(".cine-boton-principal")).toHaveCount(0);
  soltar();
  await expect(page.locator(".cine-estante").getByRole("button", { name: "Coco" })).toBeVisible();
  await expect(page.locator(".cine-esqueleto")).toHaveCount(0);
  await contexto.close();
});
