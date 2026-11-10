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
  await page.getByRole("button", { name: "Ver aquí solo" }).click();
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
  await page.getByRole("button", { name: "Ver aquí solo" }).click();
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
