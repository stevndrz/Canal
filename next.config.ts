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
 * - **CSP sin `script-src`, y no por falta de ganas.** El App Router inyecta
 *   guiones en línea de arranque; permitirlos exige un `nonce` por petición.
 *   Aquí eso choca de frente con `cacheComponents`, que es lo que hace que el
 *   armazón aparezca al instante en un televisor: un nonce distinto por
 *   petición **obliga a render dinámico**, y la propia documentación de Next
 *   lo dice sin rodeos — «Partial Prerendering (PPR) is incompatible with
 *   nonce-based CSP since static shell scripts won't have access to the
 *   nonce». O sea que la única forma de escribir esa CSP es pagando con lo que
 *   más se nota desde el sofá.
 *
 *   (De paso: el archivo que haría falta ya no se llama `middleware.ts`. En
 *   Next 16 esa convención está deprecada y renombrada a `proxy.ts`. Si algún
 *   día se retoma, es ahí donde iría — pero antes hay que decidir qué se hace
 *   con el prerenderizado.)
 *
 *   La superficie que esto dejaría sin cubrir es hoy casi nula: no hay
 *   `dangerouslySetInnerHTML`, ni `innerHTML`, ni `eval`, ni HTML de nadie de
 *   fuera en ninguna parte de la app. Donde sí se puede poner CSP estricta y
 *   gratis es en `/api`, y ahí está puesta (ver `CABECERAS_API`).
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
    /**
     * Solo lo que la app no usa nunca. `fullscreen` y `autoplay` quedan FUERA
     * a propósito: son las dos que el reproductor necesita.
     *
     * `microphone=(self)` y no `microphone=()`: lo usa la búsqueda por voz.
     * Con la lista vacía el permiso se le niega **también a la propia app**, y
     * el fallo es de los malos — el navegador rechaza la petición sin decir por
     * qué y parece que el micrófono no funciona en ese aparato. `(self)` deja
     * pedirlo a esta página y a nadie más; los iframes de los proveedores
     * siguen sin poder tocarlo.
     */
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), midi=(), serial=(), bluetooth=()",
  },
  {
    // Que un popup que abramos no herede acceso a nuestra ventana.
    // `allow-popups` y no `same-origin` a secas: los proveedores de vídeo
    // abren ventanas y con la forma estricta dejarían de funcionar.
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin-allow-popups",
  },
  {
    // Nada de crossdomain.xml: no hay Flash ni Acrobat que deba creerse nada.
    key: "X-Permitted-Cross-Domain-Policies",
    value: "none",
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

/**
 * La CSP que en `/api` sí se puede cerrar del todo.
 *
 * Las tres rutas de API devuelven JSON. No cargan un guion, ni una hoja de
 * estilo, ni una imagen, ni se meten en un marco: no hay nada que una CSP
 * estricta pueda romper ahí, así que aquí no hay ningún compromiso que
 * negociar — al revés que en la página, donde el nonce chocaba con el
 * prerenderizado.
 *
 * Qué gana: si algún día una de estas rutas acaba devolviendo HTML por un
 * error de programación (un mensaje de error sin escapar, una respuesta mal
 * construida), el navegador no ejecutará nada de lo que venga dentro. Es una
 * red de seguridad para un fallo que hoy no existe, y cuesta dos líneas.
 */
const CABECERAS_API = [
  {
    key: "Content-Security-Policy",
    value: "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  },
];

const nextConfig: NextConfig = {
  /**
   * Componentes de caché: prerenderizado parcial del armazón en build.
   *
   * Es lo que convierte el clic en «Cine y series» —y cualquier entrada a
   * estas rutas— en algo instantáneo: la barra y el esqueleto se sirven ya
   * construidos desde la primera visita, sin esperar render del servidor, y
   * solo los datos (TMDB, la lista M3U) streamean detrás.
   *
   * Antes, el prefetch de una ruta dinámica esperaba al render COMPLETO antes
   * de emitir un solo byte (medido: 8 s con TMDB lenta), así que ninguna otra
   * combinación de trucos tocaba el problema de fondo. Con esto el armazón ya
   * no depende ni del render ni de la red.
   */
  cacheComponents: true,

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
    return [
      { source: "/:ruta*", headers: CABECERAS_SEGURIDAD },
      // Después, para que gane en las rutas que cubre: las de `/api` reciben
      // las generales y encima la CSP cerrada.
      { source: "/api/:ruta*", headers: CABECERAS_API },
    ];
  },
};

export default nextConfig;
