import type { NextConfig } from "next";

/**
 * `hls.js` y `mpegts.js` solo pueden vivir en el navegador: al evaluarse
 * tocan `self`, que en Node no existe. Marcarlos como externos del servidor
 * evita que entren ahí.
 */
const nextConfig: NextConfig = {
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
};

export default nextConfig;