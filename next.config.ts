import type { NextConfig } from "next";

/**
 * `hls.js` y `mpegts.js` solo pueden vivir en el navegador: al evaluarse
 * tocan `self`, que en Node no existe. Si el empaquetador los mete en el
 * paquete del servidor, la página revienta con
 * `ReferenceError: self is not defined` y Vercel responde 500 — es lo que ya
 * pasó una vez con este diseño. Marcarlos como externos del servidor evita
 * que entren ahí; el reproductor los sigue cargando en el navegador con
 * `next/dynamic({ ssr: false })`.
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["hls.js", "mpegts.js"],

  /**
   * El indicador de desarrollo de Next se coloca abajo a la izquierda, que es
   * exactamente donde vive la primera pestaña de la barra inferior del
   * teléfono: mientras se desarrolla, "Inicio" no se puede pulsar. No afecta a
   * producción —ese elemento no se emite—, pero sí a cualquier prueba en un
   * móvil real o automatizada.
   */
  devIndicators: {
    position: "top-right",
  },
};

export default nextConfig;
