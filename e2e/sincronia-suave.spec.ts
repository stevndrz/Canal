import { expect, test, type Browser, type Page } from "@playwright/test";
import { nuevoAparato, type NombreAparato } from "./aparatos";
import { CLAVE_PUSHER, SECRETO_PUSHER } from "./constantes.mjs";
import { crearPusherFalso, type PusherFalso } from "./pusher-falso";

/**
 * Sincronía suave: en la ficha de un título (reproductor de otro dominio, que
 * no se puede mandar) la sala lleva el reloj. Los servidores de vídeo se
 * cortan: aquí se prueba la sala, no a Vimeus.
 */

const FICHA = "/peliculas/movie/tmdb-155";

async function abrirFicha(browser: Browser, pusher: PusherFalso, cual: NombreAparato, alias: string, sala: string): Promise<Page> {
  const contexto = await nuevoAparato(browser, cual);
  await pusher.conectar(contexto);
  // Los marcos de los servidores de cine, fuera: ni red ni anuncios en la prueba.
  await contexto.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (ruta) => ruta.abort());
  // Como si este aparato ya hubiera estado en la sala desde Mi enlace.
  await contexto.addInitScript(
    ([nombre, codigo]) => {
      if (!localStorage.getItem("canalcasa:juntos-perfil")) {
        localStorage.setItem("canalcasa:juntos-perfil", JSON.stringify({ id: `aparato-${nombre}`.replace(/[^a-z0-9-]/gi, "x").padEnd(10, "0"), nombre }));
        if (codigo) localStorage.setItem("canalcasa:juntos-ultima-sala", JSON.stringify(codigo));
      }
    },
    [alias, sala] as const,
  );
  const page = await contexto.newPage();
  await page.goto(FICHA);
  return page;
}

const franja = (page: Page) => page.getByRole("region", { name: "Ver a la vez" });
const relojDe = async (page: Page) => {
  const texto = (await franja(page).getByRole("status").textContent()) ?? "";
  const m = /(\d+):(\d\d)/.exec(texto);
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
};

test.describe("Sincronía suave (Vimeus)", () => {
  let pusher: PusherFalso;
  test.beforeEach(() => {
    pusher = crearPusherFalso(CLAVE_PUSHER, SECRETO_PUSHER);
  });

  test("sin sala recordada, la ficha no enseña nada de esto", async ({ browser }) => {
    const page = await abrirFicha(browser, pusher, "pc", "Steven", "");
    await expect(page.getByRole("heading", { name: "Película de prueba" }).first()).toBeVisible();
    await expect(page.getByText(/Ver a la vez/)).toHaveCount(0);
    await page.context().close();
  });

  test("Listo → cuenta atrás → reloj compartido → pausa para todos → «voy por…»", async ({ browser }) => {
    const pc = await abrirFicha(browser, pusher, "pc", "Steven", "4821");
    const movil = await abrirFicha(browser, pusher, "iphone", "Telefono", "4821");

    // Discreto: un enlace de texto, y nada conectado hasta pulsarlo.
    await pc.getByRole("button", { name: "Ver a la vez con la sala 4821" }).click();
    await movil.getByRole("button", { name: "Ver a la vez con la sala 4821" }).click();
    await expect(franja(pc)).toContainText("Telefono");
    await expect(franja(movil)).toContainText("Steven");
    expect(pusher.rechazadas).toEqual([]);

    // Cada uno pasa sus anuncios y dice que está listo.
    await pc.getByRole("button", { name: "Listo", exact: true }).click();
    await expect(franja(movil)).toContainText("Steven ✓");
    await movil.getByRole("button", { name: "Listo", exact: true }).click();

    // Con todos listos, cualquiera empieza: cuenta atrás en los dos.
    await pc.getByRole("button", { name: "Empezar", exact: true }).click();
    await expect(movil.locator(".cine-cuenta")).toBeVisible();
    await expect(franja(pc)).toContainText("Deberían ir por", { timeout: 8000 });
    await expect(franja(movil)).toContainText("Deberían ir por", { timeout: 8000 });
    await pc.waitForTimeout(3000);
    const [a, b] = await Promise.all([relojDe(pc), relojDe(movil)]);
    expect(a).toBeGreaterThanOrEqual(2);
    expect(Math.abs(a - b)).toBeLessThanOrEqual(1);

    // Pausa para todos, desde el teléfono: se congela en los dos.
    await movil.getByRole("button", { name: "Pausa para todos" }).click();
    await expect(franja(pc)).toContainText("En pausa en");
    const parado = await relojDe(pc);
    await pc.waitForTimeout(2000);
    expect(await relojDe(pc)).toBe(parado);

    // «Voy por 12:34»: corrige el reloj de la sala, que sigue en pausa.
    await pc.getByRole("button", { name: "Voy por…" }).click();
    await pc.getByLabel("Por dónde vas (minuto:segundo)").fill("12:34");
    await pc.getByRole("button", { name: "Poner" }).click();
    await expect(franja(movil)).toContainText("En pausa en 12:34");

    // Seguir: otra cuenta atrás y el reloj corre desde ahí en los dos.
    await movil.getByRole("button", { name: "Seguir todos" }).click();
    await expect(franja(pc)).toContainText("Deberían ir por 12:3", { timeout: 8000 });

    // Estos mensajes van por su propio evento: no son los de «Nuestras películas».
    expect(pusher.mensajes.length).toBeGreaterThan(4);

    await pc.context().close();
    await movil.context().close();
  });

  test("quien llega tarde recibe por dónde va la sala", async ({ browser }) => {
    const pc = await abrirFicha(browser, pusher, "pc", "Steven", "4821");
    await pc.getByRole("button", { name: "Ver a la vez con la sala 4821" }).click();
    await pc.getByRole("button", { name: "Listo", exact: true }).click();
    await pc.getByRole("button", { name: "Empezar sin esperar" }).click();
    await expect(franja(pc)).toContainText("Deberían ir por", { timeout: 8000 });
    await pc.getByRole("button", { name: "Voy por…" }).click();
    await pc.getByLabel("Por dónde vas (minuto:segundo)").fill("40:00");
    await pc.getByRole("button", { name: "Poner" }).click();

    const tarde = await abrirFicha(browser, pusher, "iphone", "Telefono", "4821");
    await tarde.getByRole("button", { name: "Ver a la vez con la sala 4821" }).click();
    await expect(franja(tarde)).toContainText("Deberían ir por 40:", { timeout: 8000 });

    await pc.context().close();
    await tarde.context().close();
  });
});
