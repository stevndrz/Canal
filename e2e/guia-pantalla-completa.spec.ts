import { expect, test } from "@playwright/test";
import { nuevoAparato } from "./aparatos";

/**
 * La guía de pantalla completa, como la de una caja de cable: recorrerla con
 * las flechas NO cambia de canal; solo OK sintoniza. En las pruebas no hay
 * guía de programación, así que las filas dicen «Sin programación», y aun así
 * sirve para elegir canal.
 */
test("PC: la guía se recorre con las flechas sin cambiar de canal, OK sintoniza y Atrás la cierra", async ({ browser }) => {
  const contexto = await nuevoAparato(browser, "pc");
  const page = await contexto.newPage();
  await page.goto("/");
  await page.locator(".casa-boton", { hasText: "Canal 7" }).click();
  await page.locator(".live-card").getByRole("button", { name: "Pantalla completa", exact: true }).click();
  await expect(page.locator(".reproductor-completo")).toBeVisible();

  const guia = page.locator(".guia-tv");
  const enfocada = guia.locator(".guia-tv-fila.is-foco .guia-tv-canal span");
  const sonando = guia.locator(".guia-tv-fila.is-sonando .guia-tv-canal span");

  // Atrás con la guía abierta la cierra a ella, no la pantalla completa.
  await page.keyboard.press("Enter");
  await expect(guia).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(guia).toHaveCount(0);
  await expect(page.locator(".reproductor-completo")).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(enfocada).toHaveText("Canal 7");
  await expect(guia.locator(".guia-tv-programa").first()).toContainText("Sin programación");

  await page.keyboard.press("ArrowDown");
  await expect(enfocada).not.toHaveText("Canal 7");
  const elegido = await enfocada.textContent();
  // Moverse no sintoniza: sigue sonando el 7.
  await expect(sonando).toHaveText("Canal 7");
  await page.keyboard.press("ArrowRight");
  await expect(guia).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(guia).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(sonando).toHaveText(elegido!);
  await contexto.close();
});
