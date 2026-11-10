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
