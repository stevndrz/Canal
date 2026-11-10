import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * Pruebas de navegador: la app de verdad, compilada, con varios aparatos a la
 * vez. `npm run e2e`.
 *
 * Por qué existen: Ver juntos solo se rompe ENTRE aparatos (un play que no
 * llega, un eco que vuelve), y eso no lo ve ni `vitest` ni un solo navegador.
 * Hasta ahora cada sesión rehacía estas pruebas a mano y se perdían.
 *
 * Qué simulan y qué no: Pusher es de mentira pero **comprueba la firma** de
 * `/api/pusher/auth` con el secreto (ver `e2e/pusher-falso.ts`); el bucket de
 * películas y la lista M3U los sirve `e2e/servidor.mjs`. El vídeo es WebM: el
 * Chromium de pruebas no trae H.264, así que el HLS de verdad NO se prueba
 * aquí.
 */

/**
 * Qué Chromium se lanza. Por defecto, el que descarga `playwright install`
 * para la versión fijada en package.json (así va el CI y cualquier PC).
 *
 * Las sesiones en la nube traen UN Chromium ya instalado y sin red para bajar
 * otro: cuando Dependabot sube `@playwright/test`, deja de coincidir y la
 * suite entera fallaba con «Executable doesn't exist». Si ese navegador está,
 * se usa. `CANALCASA_CHROMIUM` apunta a otro a mano.
 */
const CHROMIUM_INSTALADO = "/opt/pw-browsers/chromium";
const chromium = process.env.CANALCASA_CHROMIUM || (!process.env.CI && existsSync(CHROMIUM_INSTALADO) ? CHROMIUM_INSTALADO : undefined);

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  // Las salas comparten un Pusher de mentira en memoria: de una en una.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: "http://localhost:3210",
    trace: "off",
    launchOptions: {
      executablePath: chromium,
      // En pruebas no hay dedo que dé el primer toque. El camino «sin gesto»
      // (iPhone) no se puede probar con Chromium de todas formas.
      args: ["--autoplay-policy=no-user-gesture-required"],
    },
  },
  webServer: {
    command: "node e2e/servidor.mjs",
    url: "http://localhost:3210/sistema",
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
  },
});
