import type { Browser, BrowserContext, BrowserContextOptions } from "@playwright/test";

/** Los tres aparatos de la casa, como los ve la app. */
const TELE_UA =
  "Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36";

export const APARATOS = {
  pc: { viewport: { width: 1600, height: 1000 } },
  iphone: { viewport: { width: 393, height: 852 }, hasTouch: true, isMobile: true },
  tele: { viewport: { width: 1920, height: 1080 }, userAgent: TELE_UA },
} satisfies Record<string, BrowserContextOptions>;

export type NombreAparato = keyof typeof APARATOS;

let siguiente = 1;

/** Una IP distinta cada vez, para `x-real-ip`. */
export function ipDePrueba(): string {
  siguiente += 1;
  return `10.${(siguiente >> 16) & 255}.${(siguiente >> 8) & 255}.${siguiente & 255}`;
}

/**
 * Un aparato nuevo, con su propio almacenamiento y **su propia IP**.
 *
 * El freno de peticiones de `/api/*` cuenta por IP (30 por minuto), y en las
 * pruebas todos los navegadores salen de 127.0.0.1: sin esto, la suite entera
 * comparte un cupo y las últimas pruebas reciben 429 sin que nada esté roto.
 */
export async function nuevoAparato(browser: Browser, cual: NombreAparato): Promise<BrowserContext> {
  const contexto = await browser.newContext(APARATOS[cual]);
  const ip = ipDePrueba();
  // Solo a nuestras rutas: puesta en todas las peticiones, la cabecera obliga
  // a un preflight de CORS contra el bucket de películas, que el de verdad
  // no espera.
  await contexto.route(/^http:\/\/localhost:\d+\/api\//, (ruta) =>
    ruta.continue({ headers: { ...ruta.request().headers(), "x-real-ip": ip } }),
  );
  return contexto;
}
