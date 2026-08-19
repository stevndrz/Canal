import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Sin optimizador: los pósters ya se piden a TMDB en su tamaño exacto
    // (w342) y los logos de canal vienen de dominios arbitrarios del M3U.
    // Además el optimizador no existe al empaquetar para Tizen.
    unoptimized: true,
  },
};

export default nextConfig;
