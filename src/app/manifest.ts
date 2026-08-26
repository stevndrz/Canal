import type { MetadataRoute } from "next";

/**
 * Para poder instalarla como una aplicación.
 *
 * Sin manifiesto, CanalCasa es una pestaña más: en el teléfono hay que
 * recordar la dirección y en el televisor hay que navegar por el navegador
 * hasta ella. Con él se instala con su icono, arranca a pantalla completa sin
 * la barra de direcciones —que en una tele son cien píxeles de nada robados al
 * vídeo— y aparece entre las aplicaciones del sistema.
 *
 * Es además el paso previo a empaquetarla para Tizen: ese formato parte de un
 * manifiesto web.
 *
 * **Sin service worker, y a propósito.** Aquí no hay nada que servir sin
 * conexión: todo son emisiones remotas y catálogos que cambian. Un SW en el
 * navegador de un televisor solo aporta caché rancia y fallos difíciles de
 * ver, a cambio de nada.
 *
 * Next sirve esto en `/manifest.webmanifest` y lo enlaza solo; no hay que
 * tocar `layout.tsx`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CanalCasa",
    short_name: "CanalCasa",
    description: "La televisión de casa: canales en vivo, películas y series.",
    lang: "es",
    start_url: "/",
    // `standalone` y no `fullscreen`: en el teléfono conviene que se vea la
    // hora y la batería, y la pantalla completa de verdad la pide el
    // reproductor cuando hace falta.
    display: "standalone",
    orientation: "any",
    // Los dos del mismo negro que el fondo de la app: si difieren, al arrancar
    // se ve un destello del color del sistema antes del primer fotograma.
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["entertainment", "video"],
    icons: [
      // `maskable` además de `any`: sin él, Android recorta el icono en un
      // círculo y se lleva por delante las antenas del televisor.
      { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
