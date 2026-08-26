import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad.
 *
 * La app no tenía ninguna: Vercel solo añade HSTS, y solo en los dominios
 * `*.vercel.app` — en dominio propio, nada.
 *
 * Lo que va aquí es **todo lo que se puede poner sin romper la app**, que no es
 * lo mismo que «todo lo que existe». Las tres exclusiones de abajo no son
 * pereza; cada una rompía algo concreto:
 *
 * - **`Permissions-Policy` sin `fullscreen` ni `autoplay`.** El iframe del
 *   reproductor declara `allow="autoplay; encrypted-media; fullscreen"`
 *   (`ficha-reproductor.tsx`). Una política restrictiva a nivel de documento
 *   **anula ese `allow`** y deja el reproductor sin arrancar ni poder ponerse a
 *   pantalla completa. Se restringen las capacidades que la app no usa jamás.
 *
 * - **CSP sin `script-src`.** El App Router inyecta guiones en línea de
 *   arranque; permitirlos exige un `nonce` por petición, y eso exige un
 *   `middleware.ts` que hoy no existe. Poner `'unsafe-inline'` para salir del
 *   paso sería escribir la palabra CSP sin obtener su protección.
 *
 * - **CSP sin listas blancas de `media-src`, `connect-src`, `img-src` ni
 *   `frame-src`.** La lista M3U trae canales de cientos de dominios que rotan
 *   solos, los logos salen de dominios arbitrarios (`tvg-logo`), y los de los
 *   proveedores de vídeo **cambian sin aviso** — lo dice el comentario de
 *   `providers.ts`. Cualquier lista fija convierte una rotación de dominio en
 *   una pantalla en blanco sin mensaje de error. Una CSP a medias aquí sería
 *   peor que ninguna: da confianza falsa y rompe canales en silencio.
 *
 * Lo que sí protege `frame-ancestors`: que **otra** web incruste CanalCasa para
 * suplantarla. Eso no tiene nada que ver con los iframes que CanalCasa incrusta
 * (eso sería `frame-src`) y es gratis.
 */
const CABECERAS_SEGURIDAD = [
  {
    // Dos años. La app es HTTPS puro; no hay nada que servir por HTTP.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    // Que el navegador no adivine el tipo de un recurso por su contenido.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Al salir a otro dominio viaja el origen, nunca la ruta. Los iframes de
    // los proveedores fijan además su propio `referrerPolicy="origin"`, que
    // gana a esta porque el atributo del elemento tiene prioridad.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Solo lo que la app no usa nunca. `fullscreen` y `autoplay` quedan FUERA
    // a propósito: son las dos que el reproductor necesita.
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), midi=(), serial=(), bluetooth=()",
  },
  {
    // Para los navegadores que aún no leen `frame-ancestors`.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // La única CSP que se puede sostener hoy. Ver el comentario de arriba.
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  /**
   * `hls.js` y `mpegts.js` solo pueden vivir en el navegador: al evaluarse
   * tocan `self`, que en Node no existe. Marcarlos como externos del servidor
   * evita que entren ahí.
   */
  serverExternalPackages: ["hls.js", "mpegts.js"],

  /**
   * Posiciona el indicador de desarrollo para no obstruir controles móviles.
   */
  devIndicators: {
    position: "top-right",
  },

  /**
   * Declaración de dominios autorizados para `next/image`.
   */
  images: {
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org" }],
  },

  async headers() {
    return [{ source: "/:ruta*", headers: CABECERAS_SEGURIDAD }];
  },
};

export default nextConfig;
